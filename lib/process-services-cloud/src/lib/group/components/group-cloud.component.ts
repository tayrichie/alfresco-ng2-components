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

import {
    Component,
    ElementRef,
    OnInit,
    Output,
    EventEmitter,
    ViewChild,
    ViewEncapsulation,
    Input,
    SimpleChanges,
    OnChanges,
    OnDestroy,
    ChangeDetectionStrategy,
    SimpleChange
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Observable, of, BehaviorSubject, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/internal/operators/debounceTime';
import { distinctUntilChanged, switchMap, mergeMap, filter, tap, map, takeUntil } from 'rxjs/operators';
import {
    IdentityGroupModel,
    IdentityGroupSearchParam,
    IdentityGroupService,
    LogService
} from '@alfresco/adf-core';

@Component({
    selector: 'adf-cloud-group',
    templateUrl: './group-cloud.component.html',
    styleUrls: ['./group-cloud.component.scss'],
    animations: [
        trigger('transitionMessages', [
            state('enter', style({ opacity: 1, transform: 'translateY(0%)' })),
            transition('void => enter', [
                style({ opacity: 0, transform: 'translateY(-100%)' }),
                animate('300ms cubic-bezier(0.55, 0, 0.55, 0.2)')
            ])
        ])
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None
})
export class GroupCloudComponent implements OnInit, OnChanges, OnDestroy {

    static MODE_SINGLE = 'single';
    static MODE_MULTIPLE = 'multiple';

    /** Name of the application. If specified this shows the groups who have access to the app. */
    @Input()
    appName: string;

    /** Title of the field */
    @Input()
    title: string;

    /** Group selection mode (single/multiple). */
    @Input()
    mode: string = GroupCloudComponent.MODE_SINGLE;

    /** Array of groups to be pre-selected. This pre-selects all groups in multi selection mode and only the first group of the array in single selection mode. */
    @Input()
    preSelectGroups: IdentityGroupModel[] = [];

    /** This flag enables the validation on the preSelectGroups passed as input.
     * In case the flag is true the components call the identity service to verify the validity of the information passed as input.
     * Otherwise, no check will be done.
     */
    @Input()
    validate: Boolean = false;

    /** Show the info in readonly mode
     */
    @Input()
    readOnly: boolean = false;

    /** FormControl to search the group */
    @Input()
    searchGroupsControl: FormControl = new FormControl();

    /** Role names of the groups to be listed. */
    @Input()
    roles: string[] = [];

    /** Emitted when a group is selected. */
    @Output()
    selectGroup = new EventEmitter<IdentityGroupModel>();

    /** Emitted when a group is removed. */
    @Output()
    removeGroup = new EventEmitter<IdentityGroupModel>();

    /** Emitted when a group selection change. */
    @Output()
    changedGroups = new EventEmitter<IdentityGroupModel[]>();

    /** Emitted when an warning occurs. */
    @Output()
    warning = new EventEmitter<any>();

    @ViewChild('groupInput')
    private groupInput: ElementRef<HTMLInputElement>;

    private selectedGroups: IdentityGroupModel[] = [];

    private searchGroups: IdentityGroupModel[] = [];
    searchGroupsSubject = new BehaviorSubject<IdentityGroupModel[]>([]);

    searchGroups$: Observable<IdentityGroupModel[]>;

    _subscriptAnimationState = 'enter';
    clientId: string;
    isFocused: boolean;

    private onDestroy$ = new Subject<boolean>();
    currentTimeout: any;

    validateGroupsMessage: string;

    constructor(
        private identityGroupService: IdentityGroupService,
        private logService: LogService) {
    }

    ngOnInit() {
        if (this.hasPreSelectGroups()) {
            this.selectedGroups = [...this.preSelectGroups];
        }
        this.initSubjects();
        this.loadClientId();
        this.initSearch();
    }

    ngOnChanges(changes: SimpleChanges) {
        this.initSubjects();

        if (this.isPreselectedGroupsChanged(changes)) {
            this.loadPreSelectGroups();
        }

        if (changes.appName && this.isAppNameChanged(changes.appName)) {
            this.loadClientId();
            this.initSearch();
        }
    }

    private isPreselectedGroupsChanged(changes: SimpleChanges): boolean {
        return changes.preSelectGroups
            && changes.preSelectGroups.previousValue !== changes.preSelectGroups.currentValue
            && this.hasPreSelectGroups();
    }

    private isAppNameChanged(change: SimpleChange): boolean {
        return change && change.previousValue !== change.currentValue && this.appName && this.appName.length > 0;
    }

    private async loadClientId() {
        this.clientId = await this.identityGroupService.getClientIdByApplicationName(this.appName).toPromise();
    }

    initSubjects() {
        if (this.searchGroupsSubject === undefined) {
            this.searchGroupsSubject = new BehaviorSubject<IdentityGroupModel[]>(this.searchGroups);
            this.searchGroups$ = this.searchGroupsSubject.asObservable();
        }
    }

    initSearch() {
        this.searchGroupsControl.valueChanges.pipe(
            filter((value) => {
                return typeof value === 'string';
            }),
            tap((value) => {
                if (value) {
                    this.setError();
                } else {
                    if (!this.isMultipleMode()) {
                        this.removeGroup.emit();
                    }
                }
            }),
            debounceTime(500),
            distinctUntilChanged(),
            tap(() => {
                this.resetSearchGroups();
            }),
            switchMap((inputValue) => {
                const queryParams = this.createSearchParam(inputValue);
                return this.identityGroupService.findGroupsByName(queryParams);
            }),
            mergeMap((groups) => {
                return groups;
            }),
            filter((group: any) => {
                return !this.isGroupAlreadySelected(group);
            }),
            mergeMap((group: any) => {
                if (this.appName) {
                    return this.checkGroupHasAccess(group.id).pipe(
                        mergeMap((hasRole) => {
                            return hasRole ? of(group) : of();
                        })
                    );
                } else if (this.hasRoles()) {
                    return this.filterGroupsByRoles(group);
                } else {
                    return of(group);
                }
            }),
            takeUntil(this.onDestroy$)
        ).subscribe((searchedGroup: any) => {
            this.searchGroups.push(searchedGroup);
            this.searchGroupsSubject.next(this.searchGroups);
        });

        if (this.clientId) {
            this.searchGroupsControl.enable();
        }

    }

    checkGroupHasAccess(groupId: string): Observable<boolean> {
        if (this.hasRoles()) {
            return this.identityGroupService.checkGroupHasAnyClientAppRole(groupId, this.clientId, this.roles);
        } else {
            return this.identityGroupService.checkGroupHasClientApp(groupId, this.clientId);
        }
    }

    private isGroupAlreadySelected(group: IdentityGroupModel): boolean {
        if (this.selectedGroups && this.selectedGroups.length > 0 && this.isMultipleMode()) {
            const result = this.selectedGroups.find((selectedGroup: IdentityGroupModel) => {
                return selectedGroup.id === group.id;
            });

            return !!result;
        }
        return false;
    }

    async searchGroup(groupName: any): Promise<IdentityGroupModel> {
        return (await this.identityGroupService.findGroupsByName(this.createSearchParam(groupName)).toPromise())[0];
    }

    async validatePreselectGroups() {
        await Promise.all(this.selectedGroups.map(async (group: IdentityGroupModel) => {
            try {
                const validationResult = await this.searchGroup(group);
                if (validationResult.id || validationResult.name.length > 0) {
                    group.isValid = true;
                }
            } catch (error) {
                group.isValid = false;
                this.logService.error(error);
            }
        }));
    }

    public checkPreselectValidationErrors() {
        const invalidGroups: IdentityGroupModel[] = [];

        this.selectedGroups.forEach(group => {
            if (group.isValid !== true) {
                invalidGroups.push(group);
            }
        });

        if (invalidGroups) {
            this.generateInvalidUsersMessage(invalidGroups);
        }

        this.warning.emit({
            message: 'INVALID_PRESELECTED_USERS',
            groups: invalidGroups
        });
        if (invalidGroups.length > 0) {
            this.searchGroupsControl.setErrors({ invalid: true });
        }
    }

    generateInvalidUsersMessage(invalidGroups: IdentityGroupModel[]) {
        this.validateGroupsMessage = '';

        invalidGroups.forEach((invalidGroup: IdentityGroupModel) => {
            this.validateGroupsMessage += `${invalidGroup.name}, `;
        });

        if (this.validateGroupsMessage) {
            this.validateGroupsMessage = `Invalid groups: ${this.validateGroupsMessage}`;
        }
    }

    private async loadPreSelectGroups() {

        if (this.isMultipleMode()) {
            this.selectedGroups = this.removeDuplicatedGroups(this.preSelectGroups);
        } else {
            this.selectedGroups = [this.preSelectGroups[0]];
        }

        if (this.isValidationEnabled()) {
            await this.validatePreselectGroups();
            this.checkPreselectValidationErrors();
        } else {
            this.clearError();
        }
    }

    filterGroupsByRoles(group: IdentityGroupModel): Observable<IdentityGroupModel> {
        return this.identityGroupService.checkGroupHasRole(group.id, this.roles).pipe(
            map((hasRole: boolean) => ({ hasRole: hasRole, group: group })),
            filter((filteredGroup: { hasRole: boolean, group: IdentityGroupModel }) => filteredGroup.hasRole),
            map((filteredGroup: { hasRole: boolean, group: IdentityGroupModel }) => filteredGroup.group));
    }

    onSelect(group: IdentityGroupModel) {
        this.selectGroup.emit(group);
        if (this.isMultipleMode()) {
            if (!this.isGroupAlreadySelected(group)) {
                this.selectedGroups.push(group);
            }
        } else {
            this.selectedGroups = [group];
        }

        this.changedGroups.emit(this.selectedGroups);
        this.groupInput.nativeElement.value = '';
        this.searchGroupsControl.setValue('');

        this.clearError();
        this.resetSearchGroups();
    }

    onRemove(removedGroup: IdentityGroupModel) {
        this.removeGroup.emit(removedGroup);
        const indexToRemove = this.selectedGroups.findIndex((group: IdentityGroupModel) => {
            return group.id === removedGroup.id;
        });
        this.selectedGroups.splice(indexToRemove, 1);
        this.changedGroups.emit(this.selectedGroups);
    }

    private resetSearchGroups() {
        this.searchGroups = [];
        this.searchGroupsSubject.next([]);
    }

    isSingleMode(): boolean {
        return this.mode === GroupCloudComponent.MODE_SINGLE;
    }

    isSingleSearchDisabled(): boolean {
        return this.isSingleMode() && this.selectedGroups.length > 0;
    }

    isReadonly(): boolean {
        return this.readOnly || (this.isSingleSearchDisabled() && this.selectedGroups[0].readonly);
    }

    isMultipleMode(): boolean {
        return this.mode === GroupCloudComponent.MODE_MULTIPLE;
    }

    getDisplayName(group: IdentityGroupModel): string {
        return group ? group.name : '';
    }

    private removeDuplicatedGroups(groups: IdentityGroupModel[]): IdentityGroupModel[] {
        return groups.filter((group, index, self) =>
            index === self.findIndex((auxGroup) => {
                return group.id === auxGroup.id && group.name === auxGroup.name;
            }));
    }

    private hasPreSelectGroups(): boolean {
        return this.preSelectGroups && this.preSelectGroups.length > 0;
    }

    private createSearchParam(value: string): IdentityGroupSearchParam {
        const queryParams: IdentityGroupSearchParam = { name: value };
        return queryParams;
    }

    private hasRoles(): boolean {
        return this.roles && this.roles.length > 0;
    }

    private setError() {
        this.searchGroupsControl.setErrors({ invalid: true });
    }

    private clearError() {
        this.searchGroupsControl.setErrors(null);
    }

    hasError(): boolean {
        return this.searchGroupsControl && this.searchGroupsControl.errors && (this.searchGroupsControl.errors.invalid || this.searchGroupsControl.errors.required);
    }

    setFocus(isFocused: boolean) {
        this.isFocused = isFocused;
    }

    isValidationEnabled() {
        return this.validate === true;
    }

    hasErrorMessage(): boolean {
        return !this.isFocused && this.hasError();
    }

    ngOnDestroy() {
        clearTimeout(this.currentTimeout);
        this.onDestroy$.next(true);
        this.onDestroy$.complete();
    }
}
