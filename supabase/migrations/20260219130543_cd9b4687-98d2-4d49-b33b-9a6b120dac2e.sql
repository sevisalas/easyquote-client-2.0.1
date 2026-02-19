
UPDATE product_prompt_settings 
SET admin_only = true, hide_in_documents = true 
WHERE api_user_id = 'a21eb8c8-e9fa-4afb-812f-b0fa48aea3e4' 
AND easyquote_product_id = '2dc61856-f003-4840-a167-4e9b98d796bb'
AND force_result = true;
