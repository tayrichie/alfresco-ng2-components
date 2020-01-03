#!/usr/bin/env node

/*!
 * @license
 * Copyright 2019 Alfresco Software, Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { exec } from './exec';
import { logger } from './logger';
import * as program from 'commander';
import * as ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'fs';

const SOURCE_CODE = '../../../lib/core';
const SOURCE_E2E = '../../../e2e/';
const TYPE_COMPONENT = 'component';
const TYPE_SERVICE = 'service';
const TYPE_E2E = 'e2e';

const affectedComponentsPath = [];
const affectedPages = [];
const affectedE2E = [];

function getHeadSha(branch: string) {
    logger.info(`get head sha of ${branch}`);
    const response = exec(`git merge-base origin/${branch} HEAD`, [``], {});
    logger.info(response);
    return response;
}

function parseFile(file) {
    return ts.createSourceFile(
        file,
        readFileSync(`${file}`).toString(),
        ts.ScriptTarget.ES2015,
        /*setParentNodes */ true
      );
}

function determineSHA(options: program.CommanderStatic): { currentSHA, branchHeadSHA} {
    let currentSHA: string;
    let branchHeadSHA: string;
    if (options.changes) {
        const type = options.changes;
        if (type === 'uncommitted') {
            currentSHA = '';
            branchHeadSHA = '';
        } else if ( type === 'branch') {
            currentSHA = getHeadSha(type);
            branchHeadSHA = 'HEAD';
        } else {
            currentSHA = type;
            branchHeadSHA = 'HEAD';
        }
    }
    return {currentSHA: currentSHA, branchHeadSHA: branchHeadSHA};
}

function getFileListChanges(currentSHA, branchHeadSHA) {
    logger.info(`get list of file changed currentSHA:${currentSHA} branchSHA:${branchHeadSHA}`);
    const response = exec(`git`, [`diff`, `--name-only`, `--diff-filter=AM`], {});
    logger.info(response);
    return response;
}

function convertStringToArray(list: string): string[] {
    if (list !== null) {
        logger.info('File changed:' + list.split('\n'));
        return list.split('\n').filter(name => name !== '');
    }
    return [];
}

const walkSync = function(dir, fileList, fileType) {
    const files = readdirSync(dir);
    files.forEach( (file: any) => {
      // console.log(file)
      if (statSync(dir + file).isDirectory()) {
        fileList = walkSync(`${dir}${file}/`, fileList, fileType);
      } else if (file.endsWith(`.${fileType}.ts`)) {
        fileList.push(dir + file);
      }
    });
    return fileList;
  };

function findAffectedByImport(type: string, folder: string, lookingFor: string[] ): any {
    const items = [];
    walkSync(folder, items, type);
    const affectedFiles = [];
    items.forEach( (file) => {
        if (file) {
            try {
                const sourceFile = parseFile(file);
                const importPathFile = getImports(sourceFile, lookingFor);
                if (importPathFile) {
                    affectedFiles.push(importPathFile);
                }
            } catch (error) {
                logger.error(`File ${file} does not exist`);
            }
        }
    });
    return affectedFiles;
}

function generatePageFromComponentName(componentName: string): string {
    const classNameWithoutComponent = componentName.replace('Component', 'Page');
    return classNameWithoutComponent;
}

// function delintNode2(node: ts.Node) {
//     let className, interfaceName;
//     switch (node.kind) {
//         case ts.SyntaxKind.ClassDeclaration:
//             const classDefinition = <ts.ClassDeclaration> node;
//             className = classDefinition.name.escapedText.toString();
//             break;
//         case ts.SyntaxKind.InterfaceDeclaration:
//             const interfaceDefinition = <ts.InterfaceDeclaration> node;
//             interfaceName = interfaceDefinition.name.escapedText.toString();
//             break;
//         default:
//             break;
//     }
//     ts.forEachChild(node, delintNode);
//     return {className: className, interfaceName: interfaceName};
// }

// function delint2(sourceFileTmp: ts.SourceFile): any {
//     const result = [];
//     const {className} = ts.forEachChild(sourceFileTmp, delintNode);
//     if (className) {
//         result.push(className);
//     }
//     return result;
// }

/* tslint:disable */
function getClassName(sourceFileTmp: ts.SourceFile): string {
    let classFoundName = '';
    getClassName(sourceFileTmp);
    return classFoundName;

    function getClassName(node: ts.Node) {
        switch (node.kind) {
            case ts.SyntaxKind.ClassDeclaration:
                const classDefinition = <ts.ClassDeclaration> node;
                classFoundName = classDefinition.name.escapedText.toString();
                break;
            default:
                break;
        }
        ts.forEachChild(node, getClassName);
    }
}

function getPipeName(sourceFileTmp: ts.SourceFile): string {
    let pipeFoundName = '';
    getPipeName(sourceFileTmp);
    return pipeFoundName;

    function getPipeName(node: ts.Node) {
        switch (node.kind) {
            case ts.SyntaxKind.PropertyAssignment:
                const selectorProperty = <ts.PropertyAssignment> node;
                if (selectorProperty.name.getText() === 'name') {
                    pipeFoundName = selectorProperty.initializer.getText().replace('\'', '').replace('\'', '');
                }
                break;
            default:
                break;
        }
        ts.forEachChild(node, getPipeName);
    }
}

function getSelectorName(sourceFile: ts.SourceFile): string {
    let classFoundSelector = '';
    getSelectorName(sourceFile);
    return classFoundSelector;

    function getSelectorName(node: ts.Node) {
        switch (node.kind) {
            case ts.SyntaxKind.PropertyAssignment:
                const selectorProperty = <ts.PropertyAssignment> node;
                if (selectorProperty.name.getText() === 'selector') {
                    classFoundSelector = selectorProperty.initializer.getText().replace('\'', '');
                }
                break;
            default:
                break;
        }
        ts.forEachChild(node, getSelectorName);
    }
}

function getImports(sourceFileTmp: ts.SourceFile, findFiles?: string[]): String {
    let classFoundName = '';
    getImports(sourceFileTmp);
    return classFoundName;

    function getImports(node: ts.Node) {
        switch (node.kind) {
            case ts.SyntaxKind.ImportSpecifier:
                const importSpecifier = <ts.ImportSpecifier> node;
                const fileName = importSpecifier.name.escapedText;
                const found = findFiles.some(file => file === fileName);
                if (found) {
                    // console.log(`Yeppa ${fileName} found. Run this e2e ${node.getSourceFile().fileName}`);
                    classFoundName = node.getSourceFile().fileName;
                }
                break;
            default:
                break;
        }
        ts.forEachChild(node, getImports);
    }
}

function getInterfaceName(sourceFileTmp: ts.SourceFile): String {
    let classFoundName = '';
    getInterfaceName(sourceFileTmp);
    return classFoundName;

    function getInterfaceName(node: ts.Node) {
        switch (node.kind) {
            case ts.SyntaxKind.InterfaceDeclaration:
                const classSpecifier = <ts.InterfaceDeclaration> node;
                classFoundName = classSpecifier.name.escapedText.toString();
                break;
            default:
                break;
        }
        ts.forEachChild(node, getInterfaceName);
    }
}

/* tslint:enable */
function getDirectiveName(sourceFile: ts.SourceFile): string {
    let directiveName = getSelectorName(sourceFile);
    directiveName = directiveName.replace('\'', '').replace('[', '').replace(']', '');
    return directiveName;
}

function findAffectedComponentPathByFile(sourceFile: ts.SourceFile): string[] {
    const className = getClassName(sourceFile);
    logger.info(className);
    const componentAffectedByImport = findAffectedByImport(TYPE_COMPONENT, SOURCE_CODE, [className]);
    return componentAffectedByImport;
}

function findAffectedServicePathByFile(sourceFile: ts.SourceFile): string[] {
    const className = getClassName(sourceFile);
    logger.info(className);
    const serviceAffectedByImport = findAffectedByImport(TYPE_SERVICE, SOURCE_CODE, [className]);
    return serviceAffectedByImport;
}

function findAffectedComponentWithContainsPipe(sourceFile: ts.SourceFile): string[] {
    const pipeName = getPipeName(sourceFile);
    logger.info(pipeName);
    const componentAffectedByPipe = findAffectedComponentWithTag(pipeName);
    return componentAffectedByPipe;
}

function findAffectedComponentWithContainsDirective(sourceFile: ts.SourceFile): string[] {
    const directiveName = getDirectiveName(sourceFile);
    logger.info(directiveName);
    const componentAffectedByDirective = findAffectedComponentWithTag(directiveName);
    return componentAffectedByDirective;
}

function findAffectedPage(): string[] {
    const pages = [];
    affectedComponentsPath.forEach( (file) => {
        if (file) {
            try {
                const sourceFile = parseFile(file);
                const componentName = getClassName(sourceFile);
                logger.info(componentName);
                // const selectorName = getSelectorName(sourceFile);
                // logger.info(selectorName);
                const affectedComponentPage = generatePageFromComponentName(componentName);
                pages.push(affectedComponentPage);
            } catch (error) {
                logger.error(`File ${file} does not exist`);
            }
        }
    });
    return pages;
}

function findAffectedComponentWithTag(tagName: string): string[] {
    const pages = [];
    try {
        const files = exec(`grep`, [`${tagName}`, `--include=\*.html`, `-lr`, SOURCE_CODE], {});
        const componentHTML = convertStringToArray(files);
        componentHTML.map( (fileName) => {
            pages.push(fileName.replace('.html', '.ts'));
        });
    } catch (error) {
        logger.error(`Nothing found with tag ${tagName}`);
    }
    return pages;
}

function findAffectedE2E(): string[] {
    const e2e = [];
    affectedPages.forEach( (page) => {
        const affectedTmpE2E = findAffectedByImport(TYPE_E2E, SOURCE_E2E, [page]);
        e2e.push(...new Set(affectedTmpE2E));
        logger.info(e2e);
    });
    return e2e;
}

// function delint(sourceFileTmp: ts.SourceFile, findFiles?: string[]): String {
//     let classFoundName = '';
//     delintNode(sourceFileTmp);
//     return classFoundName;

//     function delintNode(node: ts.Node) {
//         switch (node.kind) {
//             case ts.SyntaxKind.InterfaceDeclaration:
//                 const classSpecifier = <ts.InterfaceDeclaration>node;
//                 classFoundName = classSpecifier.name.escapedText.toString();
//                 break;
//             case ts.SyntaxKind.ClassDeclaration:
//                 const classDefinition = <ts.ClassDeclaration>node;
//                 classFoundName = classDefinition.name.escapedText.toString();
//                 break;
//             case ts.SyntaxKind.ImportSpecifier:
//                 const importSpecifier = <ts.ImportSpecifier> node;
//                 const fileName = importSpecifier.name.escapedText;
//                 if (findFiles) {
//                     const found = findFiles.some(file => file === fileName);
//                     if (found) {
//                         // console.log(`Yeppa ${fileName} found. Run this e2e ${node.getSourceFile().fileName}`);
//                         classFoundName = node.getSourceFile().fileName;
//                     }
//                 }
//                 break;
//             default:
//                 break;
//         }
//         ts.forEachChild(node, delintNode);
//     }
// }

export default function () {
    main();
}

function main() {
    program
        .version('0.1.0')
        .option('-a, --changes [type]', '  Type of commit uncommitted branch sha)')
        .parse(process.argv);

    if (process.argv.includes('-h') || process.argv.includes('--help')) {
        program.outputHelp();
    }

    if (!program.changes || program.changes === '') {
        process.exit(1);
    } else if (program.changes !== '') {
        // const e2eFolder= 'e2e/tests/';
        // const componentFolder = './src/app/';

        const {currentSHA, branchHeadSHA} = determineSHA(program);
        const files = getFileListChanges(currentSHA, branchHeadSHA);
        const fileList = convertStringToArray(files);
        fileList.forEach( (file) => {
            logger.info(`Analize: ${file}`);
            try {
                const sourceFile = parseFile('../../../' + file);
                if (file.endsWith('.service.ts')) {
                    logger.info('isService');
                    const componentAffectedByImport = findAffectedComponentPathByFile(sourceFile);
                    affectedComponentsPath.push(...componentAffectedByImport);
                    logger.info(affectedComponentsPath.toString());
                } else if (file.endsWith('.pipe.ts')) {
                    logger.info('isPipe');
                    const componentAffectedByPipe = findAffectedComponentWithContainsPipe(sourceFile);
                    affectedComponentsPath.push(...componentAffectedByPipe);
                    logger.info(affectedComponentsPath.toString());
                } else if (file.endsWith('.directive.ts')) {
                    logger.info('isDirective');
                    const componentAffectedByDirective = findAffectedComponentWithContainsDirective(sourceFile);
                    affectedComponentsPath.push(...componentAffectedByDirective);
                    logger.info(affectedComponentsPath.toString());
                } else if (file.endsWith('.page.ts') || file.endsWith('Page.ts')) {
                    logger.info('isPage');
                    const className = getClassName(sourceFile);
                    affectedPages.push(className);
                    logger.info(affectedComponentsPath.toString());
                } else if (file.endsWith('.interface.ts')) {
                    logger.info('isInterface');
                    const interfaceName = getInterfaceName(sourceFile);
                    logger.info(interfaceName);
                } else if (file.endsWith('.model.ts')) {
                    logger.info('isModel');
                    const affectedServices = findAffectedServicePathByFile(sourceFile);
                    logger.info(affectedServices);
                } else if (file.endsWith('.e2e.ts')) {
                    logger.info('isE2E');
                    affectedE2E.push('../../../' + file);
                    logger.info(affectedComponentsPath.toString());
                } else if (file.endsWith('.component.html')) {
                    logger.info('isHTML');
                    affectedComponentsPath.push('../../../' + file.replace('.html', '.ts'));
                    logger.info(affectedComponentsPath.toString());
                } else if (file.endsWith('.component.ts')) {
                    logger.info('isComponent');
                    affectedComponentsPath.push('../../../' + file);
                }
            } catch (error) {
                logger.error(`File ${file} does not exist`);
            }
        });

        affectedPages.push.apply(affectedPages, findAffectedPage());
        affectedE2E.push.apply(affectedE2E, findAffectedE2E());

        logger.info(affectedE2E.toString());
    }
}
