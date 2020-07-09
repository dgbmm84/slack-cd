import os
import sys
import json
import subprocess
import re
import logging
import getpass
import os, subprocess as sp, json


def authenticateGit():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    os.environ['GIT_ASKPASS'] = os.path.join(project_dir, 'askpass.py')
    repository_fields = (re.search('//(.*?)@', repository).group(1)).split(':')
    os.environ['GIT_USERNAME'] = repository_fields[0]
    os.environ['GIT_PASSWORD'] = repository_fields[1]


def updateGitConfigFile():
    repository_fields = (re.search('//(.*?)@', repository).group(1)).split(':')
    url_git_replace = re.sub(r"(?<=\:)(.*?)(?=\@)",
                             '//' + repository_fields[0], repository)
    url_git_replace = url_git_replace.replace("/", r"\/")
    p = subprocess.Popen(["sed", "-r", "s/https.*/" + url_git_replace +
                          "/", "-i", path + "/.git/config"], stdout=subprocess.PIPE)
    p.communicate()


def flow_admin():
    result = {}
    os.chdir(path)
    result["step1"] = "Changed path [" + path + "]"
    p = subprocess.Popen(["rm", "-rf", "dist"], stdout=subprocess.PIPE)
    p.communicate()
    result["step2"] = "Remove dist folder [ rm -rf dist ]"
    p = subprocess.Popen(["git", "checkout", "."], stdout=subprocess.PIPE)
    p.communicate()
    result["step3"] = "Discard local changes [ git checkout . ]"
    p = subprocess.Popen(["git", "checkout", branch], stdout=subprocess.PIPE)
    p.communicate()
    result["step4"] = "Change branch [ git checkout " + branch + " ]"
    p = subprocess.Popen(["git", "pull"], stdout=subprocess.PIPE)
    p.communicate()
    result["step5"] = "Pull Changes [ git pull ]"
    p = subprocess.Popen(["npm", "i"], stdout=subprocess.PIPE)
    p.communicate()
    p = subprocess.Popen(["sh", base_dir + "/build.sh", node_version, project, environment, path], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    p.communicate()
    p.wait()
    result["step6"] = "exec [ sh build.sh " + node_version + " " + project + " " + environment + " " + path + " ]"
    logging.debug("exec [ sh build.sh " + node_version + " " + project + " " + environment + " " + path + "] : ")
    return result


def flow_app():
    result = {}
    os.chdir(path)
    result["step1"] = "Changed path [" + path + "]"
    logging.debug("Changed path " + path)
    p = subprocess.Popen(["rm", "-rf", "www"], stdout=subprocess.PIPE)
    p.communicate()
    result["step2"] = "Remove dist folder [ rm -rf www ]"
    logging.debug("Remove dist folder")
    p = subprocess.Popen(["git", "checkout", "."], stdout=subprocess.PIPE)
    p.communicate()
    result["step3"] = "Discard local changes [ git checkout . ]"
    logging.debug("Discard changes")
    p = subprocess.Popen(["git", "checkout", branch], stdout=subprocess.PIPE)
    p.communicate()
    result["step4"] = "Change branch [ git checkout " + branch + " ]"
    logging.debug("Change branch " + branch)
    p = subprocess.Popen(["git", "pull"], stdout=subprocess.PIPE)
    p.communicate()
    result["step5"] = "Pull Changes [ git pull ]"
    logging.debug("Pull changes")
    p = subprocess.Popen(["sh", base_dir + "/build.sh", node_version, project, environment, path], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    p.communicate()
    p.wait() 
    result["step6"] = "exec [ sh build.sh " + node_version + " " + project + " " + environment + " " + path + " ]"
    logging.debug("exec [ sh build.sh " + node_version + " " + project + " " + environment + " " + path + "] : ")
    return result


def flow_web():
    result = {}
    os.chdir(path)
    result["step1"] = "Changed path [" + path + "]"
    p = subprocess.Popen(["rm", "-rf", "dist"], stdout=subprocess.PIPE)
    p.communicate()
    result["step2"] = "Remove dist folder [ rm -rf dist ]"
    p = subprocess.Popen(["git", "checkout", "."], stdout=subprocess.PIPE)
    p.communicate()
    result["step3"] = "Discard local changes [ git checkout . ]"
    p = subprocess.Popen(["git", "checkout", branch], stdout=subprocess.PIPE)
    p.communicate()
    result["step4"] = "Change branch [ git checkout " + branch + " ]"
    p = subprocess.Popen(["git", "pull"], stdout=subprocess.PIPE)
    p.communicate()
    result["step5"] = "Pull Changes [ git pull ]"
    p = subprocess.Popen(["npm", "i"], stdout=subprocess.PIPE)
    p.communicate()
    result["step6"] = "Installing dependencies npm [ npm i ]"
    p = subprocess.Popen(
        ["npm", "run", "build:ssr:" + environment], stdout=subprocess.PIPE)
    p.communicate()
    result["step7"] = "Build [ npm run build:ssr:" + environment + " ]"
    p = subprocess.Popen(
        ["pm2", "restart", environment], stdout=subprocess.PIPE)
    p.communicate()
    result["step8"] = "Restart PM2 [ pm2 restart " + environment + " ]"
    return result


switcher = {
    "admin": flow_admin,
    "app": flow_app,
    "web": flow_web
}


def get_flow_execution(project):
    logging.basicConfig(filename='execution.log',level=logging.DEBUG)
    authenticateGit()
    updateGitConfigFile()
    func = switcher.get(project)
    return func()


args = sys.argv[1:]
path = args[0]
repository = args[1]
environment = args[2]
project = args[3]
branch = args[4]
base_dir = os.path.dirname(os.path.abspath(__file__))
node_version = "10.13"


result = get_flow_execution(project)
print(json.dumps(result))
