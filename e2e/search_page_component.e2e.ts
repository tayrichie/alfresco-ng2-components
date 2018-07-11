/*!
 * @license
 * Copyright 2016 Alfresco Software, Ltd.
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

import LoginPage = require('./pages/adf/loginPage');
import SearchDialog = require('./pages/adf/dialog/searchDialog');
import ContentServicesPage = require('./pages/adf/contentServicesPage');
import SearchResultPage = require('./pages/adf/searchResultsPage');
import filePreviewPage = require('./pages/adf/filePreviewPage');

import AcsUserModel = require('./models/ACS/acsUserModel');
import FolderModel = require('./models/ACS/folderModel');
import FileModel = require('./models/ACS/fileModel');

import TestConfig = require('./test.config');
import Util = require('./util/util');
import resources = require('./util/resources');

import AlfrescoApi = require('alfresco-js-api-node');
import { UploadActions } from './actions/ACS/upload.actions';

describe('Test Search component - Search Page', () => {
    let search = {
        active: {
            base: Util.generateRandomString(3),
            firstFile: Util.generateRandomString(),
            secondFile: Util.generateRandomString(),
            extension: '.txt'
        },
        no_permission: {
            noPermFile: 'Meetings',
            noPermFolder: 'Meeting Notes'
        }
    };

    let loginPage = new LoginPage();
    let contentServicesPage = new ContentServicesPage();
    let searchDialog = new SearchDialog();
    let searchResultPage = new SearchResultPage();

    let acsUser = new AcsUserModel();
    let emptyFolderModel = new FolderModel({ 'name': Util.generateRandomString()});
    let firstFileModel = new FileModel({
        'name': search.active.firstFile,
        'location': resources.Files.ADF_DOCUMENTS.TXT.file_location
    });
    let newFolderModel = new FolderModel({ 'name': 'newFolder' });
    let fileNames = [], adminFileNames = [], nrOfFiles = 15, adminNrOfFiles = 5;

    beforeAll(async (done) => {
        fileNames = Util.generateSeqeunceFiles(1, nrOfFiles, search.active.base, search.active.extension);
        adminFileNames = Util.generateSeqeunceFiles(nrOfFiles + 1, nrOfFiles + adminNrOfFiles, search.active.base, search.active.extension);

        let uploadActions = new UploadActions();

        this.alfrescoJsApi = new AlfrescoApi({
            provider: 'ECM',
            hostEcm: TestConfig.adf.url
        });

        await this.alfrescoJsApi.login(TestConfig.adf.adminEmail, TestConfig.adf.adminPassword);

        await this.alfrescoJsApi.core.peopleApi.addPerson(acsUser);

        await this.alfrescoJsApi.login(acsUser.id, acsUser.password);

        await uploadActions.uploadFolder(this.alfrescoJsApi, emptyFolderModel.name, '-my-');
        let newFolderModelUploaded = await uploadActions.uploadFolder(this.alfrescoJsApi, newFolderModel.name, '-my-');

        await uploadActions.createEmptyFiles(this.alfrescoJsApi, fileNames, newFolderModelUploaded.entry.id);

        let firstFileUploaded = await uploadActions.uploadFile(this.alfrescoJsApi, firstFileModel.location, firstFileModel.name, '-my-');
        Object.assign(firstFileModel, firstFileUploaded.entry);

        await this.alfrescoJsApi.login(TestConfig.adf.adminEmail, TestConfig.adf.adminPassword);

        await uploadActions.createEmptyFiles(this.alfrescoJsApi, adminFileNames, newFolderModelUploaded.entry.id);

        loginPage.loginToContentServicesUsingUserModel(acsUser);

        contentServicesPage.goToDocumentList();

        done();
    });

    it('1. \'No results found searching for\' message is displayed on Search Page', () => {
        let notExistentFileName = Util.generateRandomString();
        contentServicesPage.goToDocumentList();
        searchDialog.checkSearchBarIsNotVisible().checkSearchIconIsVisible().clickOnSearchIcon()
            .enterTextAndPressEnter(notExistentFileName);
        searchResultPage.checkNoResultMessageIsDisplayed();
    });

    it('2. File previewer is displayed', () => {
        contentServicesPage.goToDocumentList();

        searchDialog
            .checkSearchBarIsNotVisible()
            .checkSearchIconIsVisible()
            .clickOnSearchIcon()
            .enterTextAndPressEnter(firstFileModel.name);

        searchResultPage.checkContentIsDisplayed(firstFileModel.name);
        searchResultPage.navigateToFolder(firstFileModel.name);

        browser.driver.sleep(200);

        filePreviewPage.closePreviewWithButton();
    });

    it('3. Only the searched file is displayed', () => {
        contentServicesPage.goToDocumentList();

        searchDialog
            .checkSearchBarIsNotVisible()
            .checkSearchIconIsVisible()
            .clickOnSearchIcon()
            .enterTextAndPressEnter(search.active.firstFile);

        searchResultPage.checkContentIsDisplayed(search.active.firstFile);
        expect(searchResultPage.numberOfResultsDisplayed()).toBe(1);
    });

    it('4. Folder content is displayed', () => {
        contentServicesPage.goToDocumentList();

        searchDialog.checkSearchBarIsNotVisible()
            .checkSearchIconIsVisible()
            .clickOnSearchIcon()
            .enterTextAndPressEnter(emptyFolderModel.name);

        searchResultPage.checkNoResultMessageIsNotDisplayed();
        searchResultPage.checkContentIsDisplayed(emptyFolderModel.name);
        searchResultPage.navigateToFolder(emptyFolderModel.name);
        contentServicesPage.currentFolderName().then((result) => {
            expect(result).toEqual(emptyFolderModel.name);
        });
    });

    it('5. Delete a file from the Search Results Page', () => {
        contentServicesPage.goToDocumentList();

        searchDialog
            .checkSearchBarIsNotVisible()
            .checkSearchIconIsVisible()
            .clickOnSearchIcon()
            .enterTextAndPressEnter(search.active.firstFile);

        searchResultPage.checkContentIsDisplayed(search.active.firstFile);

        searchResultPage.deleteContent(search.active.firstFile);

        searchResultPage.checkNoResultMessageIsDisplayed();
        searchResultPage.checkContentIsNotDisplayed(search.active.firstFile);

        contentServicesPage.goToDocumentList();
        searchDialog.checkSearchBarIsNotVisible().checkSearchIconIsVisible().clickOnSearchIcon()
            .enterTextAndPressEnter(search.active.firstFile);
        searchResultPage.checkNoResultMessageIsDisplayed();
    });

    it('6. Delete a folder from the Search Results Page', () => {
        searchDialog.checkSearchBarIsNotVisible()
            .checkSearchIconIsVisible()
            .clickOnSearchIcon()
            .enterTextAndPressEnter(emptyFolderModel.name);

        searchResultPage.checkContentIsDisplayed(emptyFolderModel.name);
        searchResultPage.checkNoResultMessageIsNotDisplayed();
        searchResultPage.checkContentIsDisplayed(emptyFolderModel.name);
        searchResultPage.deleteContent(emptyFolderModel.name);
        searchResultPage.checkNoResultMessageIsDisplayed();

        searchDialog.checkSearchBarIsNotVisible().checkSearchIconIsVisible().clickOnSearchIcon()
            .enterTextAndPressEnter(emptyFolderModel.name);
        searchResultPage.checkNoResultMessageIsDisplayed();
    });

    xit('8. Sort content ascending by name.', () => {
        contentServicesPage.goToDocumentList();

        searchDialog
            .checkSearchBarIsNotVisible()
            .checkSearchIconIsVisible()
            .clickOnSearchIcon()
            .enterTextAndPressEnter(search.active.base);

        searchResultPage.checkContentIsDisplayed(search.active.secondFile);
        searchResultPage.sortAndCheckListIsOrderedByName(true).then((result) => {
            expect(result).toEqual(true);
        });
    });

    xit('9. Sort content descending by name.', () => {
        contentServicesPage.goToDocumentList();

        searchDialog.checkSearchBarIsNotVisible()
            .checkSearchIconIsVisible()
            .clickOnSearchIcon()
            .enterTextAndPressEnter(search.active.base);

        searchResultPage.checkContentIsDisplayed(search.active.secondFile);
        searchResultPage.sortAndCheckListIsOrderedByName(false).then((result) => {
            expect(result).toEqual(true);
        });
    });

    xit('10. Sort content ascending by author.', () => {
        contentServicesPage.goToDocumentList();
        searchDialog.checkSearchBarIsNotVisible().checkSearchIconIsVisible().clickOnSearchIcon()
            .enterTextAndPressEnter(search.active.base);
        searchResultPage.checkContentIsDisplayed(search.active.secondFile);
        searchResultPage.sortAndCheckListIsOrderedByAuthor(true).then((result) => {
            expect(result).toEqual(true);
        });
    });

    xit('11. Sort content descending by author.', () => {
        contentServicesPage.goToDocumentList();
        searchDialog.checkSearchBarIsNotVisible().checkSearchIconIsVisible().clickOnSearchIcon()
            .enterTextAndPressEnter(search.active.base);
        searchResultPage.checkContentIsDisplayed(search.active.secondFile);
        searchResultPage.sortAndCheckListIsOrderedByAuthor(false).then((result) => {
            expect(result).toEqual(true);
        });
    });

    xit('12. Sort content ascending by created date.', () => {
        contentServicesPage.goToDocumentList();
        searchDialog.checkSearchBarIsNotVisible().checkSearchIconIsVisible().clickOnSearchIcon()
            .enterTextAndPressEnter(search.active.base);
        searchResultPage.checkContentIsDisplayed(search.active.secondFile);
        searchResultPage.sortAndCheckListIsOrderedByCreated(true).then((result) => {
            expect(result).toEqual(true);
        });
    });

    xit('13. Sort content descending by created date.', () => {
        contentServicesPage.goToDocumentList();
        searchDialog.checkSearchBarIsNotVisible().checkSearchIconIsVisible().clickOnSearchIcon()
            .enterTextAndPressEnter(search.active.base);
        searchResultPage.checkContentIsDisplayed(search.active.secondFile);
        searchResultPage.sortAndCheckListIsOrderedByCreated(false).then((result) => {
            expect(result).toEqual(true);
        });
    });

    xit('14. Try to delete a file without rights from the Search Results Page', () => {
        contentServicesPage.goToDocumentList();
        searchDialog.checkSearchBarIsNotVisible().checkSearchIconIsVisible().clickOnSearchIcon()
            .enterTextAndPressEnter(search.no_permission.noPermFile);
        searchResultPage.checkContentIsDisplayed(search.no_permission.noPermFile);
        searchResultPage.deleteContent(search.no_permission.noPermFile);
        searchResultPage.checkContentIsDisplayed(search.no_permission.noPermFile);
        searchDialog.checkSearchBarIsNotVisible().checkSearchIconIsVisible().clickOnSearchIcon()
            .enterTextAndPressEnter(search.no_permission.noPermFile);
        searchResultPage.checkNoResultMessageIsNotDisplayed();
        searchResultPage.checkContentIsDisplayed(search.no_permission.noPermFile);
    });

    it('15. Try to delete a folder without rights from the Search Results Page', () => {
        contentServicesPage.goToDocumentList();
        searchDialog.checkSearchBarIsNotVisible().checkSearchIconIsVisible().clickOnSearchIcon()
            .enterTextAndPressEnter(search.no_permission.noPermFolder);
        searchResultPage.checkContentIsDisplayed(search.no_permission.noPermFolder);
        searchResultPage.deleteContent(search.no_permission.noPermFolder);
        searchResultPage.checkContentIsDisplayed(search.no_permission.noPermFolder);
        searchDialog.checkSearchBarIsNotVisible().checkSearchIconIsVisible().clickOnSearchIcon()
            .enterTextAndPressEnter(search.no_permission.noPermFolder);
        searchResultPage.checkNoResultMessageIsNotDisplayed();
        searchResultPage.checkContentIsDisplayed(search.no_permission.noPermFolder);
    });
});