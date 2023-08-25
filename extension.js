const vscode = require("vscode");
const socketio = require("socket.io-client");
const fs = require("fs");
const path = require("path");
const ignore = require("ignore");

function activate(context) {
  console.log('Congratulations, your extension "project-info" is now active!');

  // Register the command
  let disposable = vscode.commands.registerCommand("extension.choir", () => {
    vscode.window
      .showInputBox({
        prompt: "Please enter your token:",
        placeHolder: "Valid Code Choir Token",
      })
      .then((token) => {
        if (token) {
          const socket = socketio.connect("http://localhost:3000");
          const userToken = token;
          socket.on("connect", () => {
            const rootDirectory = getWorkspaceRootDirectory();
            if (rootDirectory) {
              const folderTree = generateFolderTree(rootDirectory);
              let filesTree = JSON.stringify(folderTree, null, 2);
              socket.emit("filesTree", { tree: filesTree, userToken });
            } else {
              console.log("No open workspace or folder.");
            }

            vscode.workspace.onDidChangeTextDocument((event) => {
              const changedFile = event.document.fileName;
              console.log(`File changed: ${changedFile}`);
              const fileContent = event.document.getText();
              socket.emit("fileChange", {
                type: "change",
                path: changedFile,
                content: fileContent,
                userToken,
              });
            });

            context.subscriptions.push({
              dispose: () => {
                socket.disconnect();
              },
            });
          });
        } else {
          console.log("Token not provided. Connection aborted.");
        }
      });
  });

  context.subscriptions.push(disposable);
}

function getWorkspaceRootDirectory() {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (workspaceFolders && workspaceFolders.length > 0) {
    // Assuming you want to get the first workspace folder's path
    const rootPath = workspaceFolders[0].uri.fsPath;
    return rootPath;
  }

  // No workspace folders are open
  return null;
}

function generateFolderTree(rootDirectory) {
  const ig = ignore();
  const gitignorePath = path.join(rootDirectory, ".gitignore");

  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
    ig.add(gitignoreContent);
  }

  const tree = {
    name: path.basename(rootDirectory),
    type: "folder",
    children: [],
  };

  const processDirectory = (dirPath, parentNode) => {
    const items = fs.readdirSync(dirPath);

    items.forEach((item) => {
      if (!ig.ignores(item)) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);

        const node = {
          name: item,
          type: stats.isFile() ? "file" : "folder",
          children: [],
        };

        if (stats.isDirectory()) {
          processDirectory(itemPath, node);
        }

        parentNode.children.push(node);
      }
    });
  };

  processDirectory(rootDirectory, tree);
  return tree;
}

module.exports = {
  activate,
};
