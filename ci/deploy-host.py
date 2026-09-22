"""Installed root-owned on the Unleash host; called only by the Jenkins deployment stage."""
import json,os,re,sys,tempfile,subprocess,urllib.request,time,shutil
from pathlib import Path
image=sys.argv[1]
if not re.fullmatch(r'registry\.fantasizetech\.co/fantasizetech/unleash-fantasize@sha256:[a-f0-9]{64}',image):raise SystemExit('Invalid image reference')
root=Path('/opt/fantasize/unleash')
auth=json.load(sys.stdin)
with tempfile.TemporaryDirectory(prefix='unleash-deploy-') as tmp:
 os.chmod(tmp,0o700)
 env={**os.environ,'DOCKER_CONFIG':tmp}
 subprocess.run(['docker','login','registry.fantasizetech.co','-u',auth['username'],'--password-stdin'],input=auth['password'],text=True,env=env,check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['docker','pull',image],env=env,check=True)
 override=root/'fantasize-image.yml'
 previous=override.read_bytes() if override.exists() else None
 override.write_text('services:\n  unleash:\n    image: '+image+'\n')
 command=['docker','compose','-f',str(root/'compose.yml'),'-f',str(override)]
 try:
  subprocess.run(command+['up','-d','--no-deps','--wait','--wait-timeout','180','unleash'],cwd=root,env=env,check=True)
  with urllib.request.urlopen('http://127.0.0.1:4242/health',timeout=10) as response:assert response.status==200
  subprocess.run([sys.executable,str(root/'verify-fork.py')],check=True)
 except Exception:
  if previous is None:
   override.unlink()
   rollback=['docker','compose','-f',str(root/'compose.yml')]
  else:
   override.write_bytes(previous);rollback=command
  subprocess.run(rollback+['up','-d','--no-deps','--wait','--wait-timeout','180','unleash'],cwd=root,env=env,check=True)
  raise
 (root/'fantasize-release.json').write_text(json.dumps({'image':image,'deployedAt':time.time()})+'\n')
 print('Healthy Unleash fork:',image)
