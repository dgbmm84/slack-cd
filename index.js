
var express = require('express'), bodyParser = require('body-parser'), request = require('request');
const git = require('simple-git/promise');
const { spawn } = require('child_process')
require('dotenv').config();

const REPOSITORY_PART = `https://${process.env.USER_GIT}:${process.env.PASS_GIT}@`;
const ENVIRONMENTS = ['alpha', 'beta', 'dev', 'demo'];
const PROJECTS = ['admin', 'app', 'web'];

// Orchestation about deployment
const FS_REPOSITORY = {
  'admin': [
    {
      'fs': [
        {
          'alpha': '<root_project_alpha>', // -- /home/project/alpha
          'beta': '<root_project_beta>',
          'dev': '<root_project_dev>',
          'demo': '<root_project_demo>'
        }
      ]
      ,
      'repository': '<uri>' // --- bitbucket.org/<organization>/project.git'
    }
  ],
  'app': [
    {
      'fs': [
        {
          'alpha': '<root_project2_alpha>',
          'beta': '<root_project2_beta>',
          'dev': '<root_project2_dev>',
          'demo': '<root_project2_demo>'
        }
      ]
      ,
      'repository': '<uri>'
    }
  ],
  'web': [
    {
      'fs': [
        {
          'alpha': '<root_project3_alpha>',
          'beta': '<root_project3_beta>',
          'dev': '<root_project3_dev>',
          'demo': '<root_project3_demo>'
        }
      ]
      ,
      'repository': '<uri>'
    }
  ],
}


const PATH_SCRIPT_DEPLOY = 'deployment_script.py';
const logOutput = (name) => (message) => console.log(`[${name}] ${message}`)
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
var port = process.env.PORT || 3000;

// ------------------------- ENDPOINTS --------------------------

app.get('/', function (req, res) {
  res.send('Ngrok is working! Path Hit: ' + req.url);
});

app.post('/init', function (req, res) {
  res.json(getRenderCommand());
});

app.post('/actions', async function (req, res) {
  let payload = JSON.parse(req.body.payload);
  let responseUrl = payload.response_url;
  
  // Slack Form for asking about Orquestation
  switch (payload.actions[0].type) {
    case 'multi_static_select':
      let userSelection = getGeneralRequirementsFromUser(payload.actions[0].selected_options);
      if (userSelection.env == undefined && userSelection.project == undefined) {
        doRequest(responseUrl, getRenderCommandAgain(), 'POST', { "Content-Type": "application/json" }, res);
      } else {
        let object = getRepositoryAndFS(userSelection.env, userSelection.project);
        await authenticateGit();
        let branches = await getBranchFromRepository(object.fs);
        doRequest(responseUrl, getRenderBranches(branches, userSelection.env, userSelection.project), 'POST', { "Content-Type": "application/json; charset=utf-8", "Authorization": "Bearer " + process.env.OAUTH_TOKEN, "Accept-Charset": "application/json" }, res);
      }
      break;
    case 'static_select':
      let [env, project, tempBranch] = payload.actions[0].selected_option.value.split('_');
      await authenticateGit();
      let object = getRepositoryAndFS(env, project);
      let branches = await getBranchFromRepository(object.fs);
      let branchSelected = composeBranchSelected(branches, tempBranch);
      let alreadySentHeaders = false;
      (async () => {
        try {
          // Preparing To deploy with all information required
          args = [PATH_SCRIPT_DEPLOY, object.fs, object.repository, env, project, branchSelected];
          let output = await run(args) // Executing hook deploy (API REST)
          logOutput('main')(output)
          alreadySentHeaders = true;
          doRequest(responseUrl, getRenderDeployFinish(env, project, branchSelected, output), 'POST', { "Content-Type": "application/json; charset=utf-8", "Authorization": "Bearer " + process.env.OAUTH_TOKEN, "Accept-Charset": "application/json" }, res);
        } catch (e) {
          console.error('Error during script execution ', e.stack);
          alreadySentHeaders = true;
          doRequest(responseUrl, getRenderDeployError(env, project, branchSelected, e.stack), 'POST', { "Content-Type": "application/json; charset=utf-8", "Authorization": "Bearer " + process.env.OAUTH_TOKEN, "Accept-Charset": "application/json" }, res);
        }
      })();
      if (!alreadySentHeaders) {
        doRequest(responseUrl, getRenderDeployStarted(), 'POST', { "Content-Type": "application/json; charset=utf-8", "Authorization": "Bearer " + process.env.OAUTH_TOKEN, "Accept-Charset": "application/json" }, res);
      }
      break;
    case 'button':
      if (payload.actions[0].value === 'cancel') {
        doRequest(responseUrl, getRenderCancel(), 'POST', { "Content-Type": "application/json; charset=utf-8", "Authorization": "Bearer " + process.env.OAUTH_TOKEN, "Accept-Charset": "application/json" }, res);
      }
      break;
    default: break;
  }
});

app.post('/events', function (req, res) {
  res.json({ "challenge": req.body.challenge })
});

// Function for returning feedback to Slack 
function doRequest(url, json, method, headers, res) {
  request({
    url: url,
    json: json,
    method: method,
    headers: headers
  }, function (error, response, body) {
    res.json(body);
  })
}

function getRenderCommandAgain() {
  let json = getRenderCommand();
  json.text = 'Select One Environment/Project please';
  json.replace_original = true;
  return json;
}

function getRenderCommand() {
  return {
    "text": "Step 1 .- ",
    "attachments": [
      {
        "blocks": [
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": " -- General requirements -- "
            },
            "accessory": {
              "type": "multi_static_select",
              "placeholder": {
                "type": "plain_text",
                "text": "Select Environment / Project"
              },
              "max_selected_items": 2,
              "option_groups": [
                {
                  "label": {
                    "type": "plain_text",
                    "text": "Environment"
                  },
                  "options": [
                    {
                      "text": {
                        "type": "plain_text",
                        "text": "Alpha"
                      },
                      "value": "alpha"
                    },
                    {
                      "text": {
                        "type": "plain_text",
                        "text": "Beta"
                      },
                      "value": "beta"
                    },
                    {
                      "text": {
                        "type": "plain_text",
                        "text": "Dev"
                      },
                      "value": "dev"
                    },
                    {
                      "text": {
                        "type": "plain_text",
                        "text": "Demo"
                      },
                      "value": "demo"
                    }
                  ]
                },
                {
                  "label": {
                    "type": "plain_text",
                    "text": "Project"
                  },
                  "options": [
                    {
                      "text": {
                        "type": "plain_text",
                        "text": "Panel"
                      },
                      "value": "admin"
                    },
                    {
                      "text": {
                        "type": "plain_text",
                        "text": "App"
                      },
                      "value": "app"
                    },
                    {
                      "text": {
                        "type": "plain_text",
                        "text": "Landing(Web)"
                      },
                      "value": "web"
                    }
                  ]
                }
              ]
            },
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": " "
            },
            "accessory": {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "Cancel"
              },
              "value": "cancel"
            }
          },
          {
            "type": "divider"
          },
        ]
      }
    ]
  };
}

function getRenderDeployStarted() {
  return {
    "text": "Deployment started ",
    "attachments": [
      {
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Deploy APP notify you when deploy will be ready ... "
            }
          },
          {
            "type": "divider"
          }
        ]
      }
    ]
  }
}

function getRenderDeployFinish(env, project, branch, output) {

  let text = "\n";
  var reverseArray = [];
  let j = 1;
  for (let i = Object.keys(output).length; i >= 1; i--) {
    reverseArray["step" + j] = output["step" + j];
    j++;
  }

  Object.keys(reverseArray).forEach(function (k) {
    text = text + "\t " + k + " -  " + reverseArray[k] + "\n";
  });
  console.log("[ getRenderDeployFinish ] ouput: " + text);
  return {
    "text": "Deployment finish ",
    "attachments": [
      {
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Deploy APP finished for deployment with requirements: \n   - *Environment*: " + env + "\n   - *Project*: " + project + "\n   - *Branch*: " + branch + "\n   - *Flow process*: " + text
            }
          },
          {
            "type": "divider"
          }
        ]
      }
    ]
  }
}

function getRenderDeployError(env, project, branch, err) {
  return {
    "text": "Deployment ERR ",
    "attachments": [
      {
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Deploy APP produced an ERROR deployment with requirements: \n   - *Environment*: " + env + "\n   - *Project*: " + project + "\n   - *Branch*: " + branch + "\n\n *Err*:" + err
            }
          },
          {
            "type": "divider"
          }
        ]
      }
    ]
  }
}

function getRenderCancel() {
  return {
    "text": " ",
    "attachments": [
      {
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Deployment was cancelled"
            }
          },
          {
            "type": "divider"
          }
        ]
      }
    ]
  }
}


function getGeneralRequirementsFromUser(selected_options) {
  let rto = {};

  let filter_selected = [];
  selected_options.map(element => { filter_selected.push(element.value); });

  rto.env = undefined;
  rto.project = undefined;
  if (filter_selected.some(selected => ENVIRONMENTS.includes(selected)) && filter_selected.some(selected => PROJECTS.includes(selected))) {
    let finalEnv = filter_selected.filter(elem => ENVIRONMENTS.includes(elem) === true);
    let finalProyect = filter_selected.filter(elem => ENVIRONMENTS.includes(elem) === true);
    if (finalEnv.length == 1 && finalProyect.length == 1) {
      rto.env = filter_selected.filter(elem => ENVIRONMENTS.includes(elem) === true);
      rto.project = filter_selected.filter(elem => PROJECTS.includes(elem) === true);
    }
  }

  return rto;
}

function getRepositoryAndFS(environment, project) {
  environment = '' + environment;
  project = '' + project
  console.log('[ getRepositoryAndFS ] Env : ' + environment + ' ; Proj : ' + project);
  console.log('[ getRepositoryAndFS ] FS : ' + FS_REPOSITORY[project][0].fs[0][environment] + ' ; REP : ' + REPOSITORY_PART + FS_REPOSITORY[project][0].repository)

  return {
    fs: FS_REPOSITORY[project][0].fs[0][environment],
    repository: REPOSITORY_PART + FS_REPOSITORY[project][0].repository
  }
}

function authenticateGit() {
  return new Promise(resolve => {
    try {
      let authenticated = git().silent(true);
      if (authenticated) {

        resolve(true);
      } else {
        console.log('Authe[ authenticateGit ] Error authenticateGitnticated')
        resolve(false);
      }
    } catch (e) {
      console.log('[ authenticateGit ] Error authenticateGit');
      resolve(false);
    }
  });
}

function composeBranchSelected(branches, tempBranch) {
  branches = branches.all.filter(branch => branch.match(/^remotes\//gi)).map(res => res.substr(15));
  let pattern = new RegExp("^(" + tempBranch + ").*");
  let filter = branches.filter(branch => branch.match(pattern));
  return filter;
}

function getBranchFromRepository(path) {
  git(path).fetch();
  return git(path).silent(true).branch();
}

function getRenderBranches(branches, env, project) {
  let namingBranches = branches.all.filter(branch => branch.match(/^remotes\//gi)).map(res => res.substr(15));
  namingBranches = namingBranches.slice(0, 100);
  let options = [];
  namingBranches.forEach(element => {
    let text_option = element.length > 35 ? String(element.substr(0, 35).concat('...')) : String(element);
    let text_value = env + '_' + project + '_' + (element.length > 35 ? String(element.substr(0, 35)) : String(element));

    options.push({ "text": { "type": "plain_text", "text": text_option }, "value": text_value })
  });

  return {
    "text": "Step 2 .- ",
    "attachments": [
      {
        "blocks": [
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "-- Select one of following remotes --"
            },
            "accessory": {
              "type": "static_select",
              "placeholder": {
                "type": "plain_text",
                "text": "Select branch"
              },
              "options": options
            },
          }
          ,
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": " "
            },
            "accessory": {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "Cancel"
              },
              "value": "cancel"
            }
          },
          {
            "type": "divider"
          },
        ]
      }
    ]
  }
}

function run(args) {
  return new Promise((resolve, reject) => {
    const process = spawn('python', args);

    const out = []
    process.stdout.on(
      'data',
      (data) => {
        out.push(data.toString());
        logOutput('stdout')(data);
      }
    );


    const err = []
    process.stderr.on(
      'data',
      (data) => {
        err.push(data.toString());
        logOutput('stderr')(data);
      }
    );

    process.on('exit', (code, signal) => {
      logOutput('exit')(`${code} (${signal})`)
      if (code !== 0) {
        reject(new Error(err.join('\n')))
        return
      }
      try {
        resolve(JSON.parse(out));
      } catch (e) {
        reject(e);
      }
    });
  });
}

app.listen(port, function () { console.log("Listening on port " + port); });
