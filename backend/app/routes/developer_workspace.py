from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from app.core.exceptions import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.middleware.auth_guard import get_current_user
from app.services.developer_workspace_service import delete_file,get_file,list_files,list_submissions,save_file,submit_file,super_admin_submissions,review_submission,sync_ide_to_db,sync_db_to_ide
router=APIRouter(tags=['Developer Workspace'])
class SaveFileBody(BaseModel):
    filename:str=Field(min_length=1,max_length=128); content:str=''
class SubmitBody(BaseModel): description:str=Field(min_length=1,max_length=2000)
class ReviewBody(BaseModel): status:str; remarks:str|None=Field(default=None,max_length=2000)
def _handle(error):
    code={BadRequestError:400,ConflictError:409,ForbiddenError:403,NotFoundError:404}.get(type(error))
    if code: raise HTTPException(status_code=code,detail=str(error))
    raise error
@router.get('/developer/workspace/files')
async def files(request:Request):
    try: return list_files(get_current_user(request)['id'])
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as e:_handle(e)
@router.post('/developer/workspace/files')
async def save(request:Request,body:SaveFileBody):
    try: return save_file(get_current_user(request)['id'],body.filename,body.content)
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as e:_handle(e)
@router.get('/developer/workspace/files/{file_id}')
async def get(request:Request,file_id:int):
    try:return {'file':get_file(get_current_user(request)['id'],file_id)}
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as e:_handle(e)
@router.delete('/developer/workspace/files/{file_id}')
async def remove(request:Request,file_id:int):
    try:return delete_file(get_current_user(request)['id'],file_id)
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as e:_handle(e)
@router.post('/developer/workspace/files/{file_id}/submit')
async def submit(request:Request,file_id:int,body:SubmitBody):
    try:return submit_file(get_current_user(request)['id'],file_id,body.description)
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as e:_handle(e)
@router.post('/developer/workspace/ide/sync')
async def sync_ide(request:Request):
    try:return sync_ide_to_db(get_current_user(request)['id'])
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as e:_handle(e)

@router.post('/developer/workspace/ide/export')
async def export_to_ide(request:Request):
    try:return sync_db_to_ide(get_current_user(request)['id'])
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as e:_handle(e)

@router.get('/developer/workspace/submissions')
async def submissions(request:Request):
    try:return list_submissions(get_current_user(request)['id'])
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as e:_handle(e)
@router.get('/super-admin/developer-submissions')
async def sa_submissions(request:Request,status:str|None=None):
    try:return super_admin_submissions(get_current_user(request)['id'],status)
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as e:_handle(e)
@router.put('/super-admin/developer-submissions/{submission_id}')
async def sa_review(request:Request,submission_id:int,body:ReviewBody):
    try:return review_submission(get_current_user(request)['id'],submission_id,body.status,body.remarks)
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as e:_handle(e)
