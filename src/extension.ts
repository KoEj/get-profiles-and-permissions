import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { API as BuiltInGitApi, GitExtension } from '../src/git';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "get-profiles-and-permissions" is now active!');

	let srcPath = path.join(__dirname, "../force-app/main/default/");
	console.log(srcPath);

	const gitApi = await getBuiltInGitApi();
	console.log(gitApi.repositories);


	let disposable = vscode.commands.registerCommand('get-profiles-and-permissions.helloWorld', async () => {
		getLines();
		vscode.window.showInformationMessage('Hello World from Get Profiles and Permissions!');
	});

	context.subscriptions.push(disposable);
};

const getBuiltInGitApi = async(): Promise<BuiltInGitApi | undefined> => {
	try {
		const extension = vscode.extensions.getExtension('vscode.git') as vscode.Extension<GitExtension>;
		if (extension !== undefined) {
			const gitExtension = extension.isActive ? extension.exports : await extension.activate();
			return gitExtension.getAPI(1);
		}
	} catch {
		console.log('!!!!!!!! - ERROR!');
	}

	return undefined;
};

// This method is called when your extension is deactivated
export function deactivate() {}

export async function getLines() {
	await getLineForStage();		
};

const getLineForStage = async(): Promise<string> => {	
	let srcPath2 = path.join(__dirname, "../force-app/main/default/permissionsets/CDP_Integration.permissionset");

	fs.readFile(srcPath2, function(err, data) {
		let stringData = data.toString('utf8');
		let myMap = new Map<string, number>();
		let field = "rac_project_scalecategory__c";

		if (stringData.search(field) === -1) {
			console.log('Does not find the field!');
		} else {
			console.log('Fieled found!');
		}

		let n = stringData.split("\n");
		let lineNumber = 1;
		for(let x in n){   
			myMap.set(n[x], lineNumber);
			lineNumber++; 
		}

		for (let key of myMap.keys()) {
			if (key.search(field) !== -1 && myMap.get(key) !== undefined && myMap.get(key) !== null) {
				console.log('FOUND!');
				getCurrentLine(srcPath2, n, myMap.get(key));
				break;
			}
		}
	});
};

export function getCurrentLine(path: string, array: string[], key: number) {
	console.log('! getCurrentLine');
	console.log(array[key]);
	console.log(key);
	stageLine(path, key);
	
};

async function stageLine(filePath: string, lineNumber: number) {
    const extension = vscode.extensions.getExtension('vscode.git') as vscode.Extension<GitExtension>;
    if (extension !== undefined) {
        const gitExtension = extension.isActive ? extension.exports : await extension.activate();
        const git = gitExtension.getAPI(1) as BuiltInGitApi;

        const repo = await git.repositories[0];
		console.log(repo);
        const diff = await repo.diffWithHEAD(filePath);
        const hunk = diff.hunks.find(hunk => hunk.newLines <= lineNumber && hunk.newStart + hunk.newLines > lineNumber);

        if (!hunk) {
            console.error(`Line number ${lineNumber} not found in file ${filePath}`);
            return;
        }

        const diffText = await repo.getChange(filePath);
        const lines = diffText.split('\n');

        let lineIndex = hunk.newStart;
        let hunkStart = 0;
        let inHunk = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('@@')) {
                if (inHunk) {
                    break;
                } else {
                    hunkStart = i;
                    inHunk = true;
                }
            } else if (inHunk) {
                if (line[0] === ' ') {
                    lineIndex++;
                } else if (line[0] === '+') {
                    lineIndex++;
                }

                if (lineIndex === lineNumber) {
                    const stagedFile = repo.createStagedFile(filePath, diffText, [hunkStart, i + 1]);
                    await git.stage(stagedFile);
                    console.log(`Staged line ${lineNumber} in ${filePath}`);
                    break;
                }
            }
        }
    }
}
