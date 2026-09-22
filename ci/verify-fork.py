"""Jenkins post-deploy checks, using disposable projects and scoped SDK tokens."""
import http.cookiejar,json,time,urllib.request,urllib.error,urllib.parse,uuid
from pathlib import Path
base='http://127.0.0.1:4242'
e=dict(line.split('=',1) for line in Path('/opt/fantasize/unleash/service.env').read_text().splitlines() if '=' in line)
admin=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(path,method='GET',data=None,token=None):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']=token
 req=urllib.request.Request(base+path,method=method,headers=headers,data=json.dumps(data).encode() if data is not None else None)
 opener=urllib.request.build_opener() if token else admin
 with opener.open(req,timeout=20) as response:
  body=response.read();return json.loads(body) if body else None
call('/auth/simple/login','POST',{'username':e['UNLEASH_DEFAULT_ADMIN_USERNAME'],'password':e['UNLEASH_DEFAULT_ADMIN_PASSWORD']})
before=call('/api/admin/projects/default/features/lading-login')
projects=[];flags=[];tokens=[]
suffix=uuid.uuid4().hex[:10]
try:
 for letter in ('a','b'):
  project=call('/api/admin/projects','POST',{'name':'QA isolation '+letter+' '+suffix,'id':'qa-'+letter+'-'+suffix})
  project_id=project['id'];projects.append(project_id)
  flag='qa-flag-'+letter+'-'+suffix
  path='/api/admin/projects/'+project_id+'/features/'+flag
  call('/api/admin/projects/'+project_id+'/features','POST',{'name':flag,'type':'release'})
  flags.append((project_id,flag))
  call(path+'/environments/development/strategies','POST',{'name':'default','parameters':{},'constraints':[]})
  call(path+'/environments/development/on','POST')
 all_ids={p['id'] for p in call('/api/admin/projects')['projects']}
 assert set(projects).issubset(all_ids), 'New projects missing from project list'
 call('/api/admin/projects/'+projects[0],'PUT',{'name':'Renamed QA '+suffix,'description':'Disposable Jenkins verification'})
 assert call('/api/admin/projects/'+projects[0]+'/overview')['name']=='Renamed QA '+suffix
 for token_type in ('client','frontend'):
  token=call('/api/admin/api-tokens','POST',{'tokenName':'qa-isolation-'+suffix,'type':token_type,'environment':'development','projects':[projects[0]]})['secret'];tokens.append(token)
  path='/api/client/features' if token_type=='client' else '/api/frontend'
  for attempt in range(20):
   data=call(path,token=token)
   names={f['name'] for f in data.get('features',data.get('toggles',[]))}
   assert flags[1][1] not in names, 'Cross-project flag leaked'
   if flags[0][1] in names:break
   time.sleep(2)
  else:raise AssertionError('Scoped token did not receive its project flag')
  try:call('/api/admin/projects','POST',{'name':'Forbidden'},token=token)
  except urllib.error.HTTPError as error:assert error.code in (401,403)
  else:raise AssertionError('SDK token unexpectedly created an admin project')
 print('PASS: create/list/rename multiple projects; client/frontend token isolation; SDK tokens cannot use admin API')
finally:
 for token in tokens:call('/api/admin/api-tokens/'+urllib.parse.quote(token,safe=''),'DELETE')
 for project,flag in flags:call('/api/admin/projects/'+project+'/features/'+flag,'DELETE')
 for project in projects:call('/api/admin/projects/'+project,'DELETE')
after=call('/api/admin/projects/default/features/lading-login')
assert [(v['name'],v['enabled']) for v in before['environments']]==[(v['name'],v['enabled']) for v in after['environments']]
existing={p['id'] for p in call('/api/admin/projects')['projects']}
if 'fantasizetech' not in existing:
 call('/api/admin/projects','POST',{'id':'fantasizetech','name':'FantasizeTech','description':'Fantasize Technology products'})
print('PASS: existing landing toggle states preserved; FantasizeTech project available')
