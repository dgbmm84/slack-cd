
-- Slack --
Command /deploy
    - ask for the Environment
    - ask for several proyects
    - ask for branch to deploy    

Automatically gets all informations about slack form by these selectors and conforms actions:
    - Check on Node all requirements for the deploy
    - Calls python script that has workflow to execute

Manually for checking incidences could be executed directly by:
    - python deployment_script.py <root_path_project> <url_repository> <environment> <project> <branch>

Requires .env with:
 USER_GIT=
 PASS_GIT=
 OAUTH_TOKEN= (slack integration)

 Slack must be configured by:
    - OAUTH_TOKEN to establish the secure connection
    - Webhook using public URL