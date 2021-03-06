import { ng } from '../ng-start';
import { Subject } from 'rxjs';
import { EdumediaElementStack } from './explorer';
import { idiom } from '../idiom';

export interface EdumediaHeaderScope {
    stack: EdumediaElementStack[];
    display: { search: string }
    canAdd: boolean;
    canShowAdd():boolean;
    isNotEmptyStack(): boolean
    currentTitle(): string;
    onSearchChange(): void
    add(): void
    goTo(item: EdumediaElementStack): void;
    //out
    notifyGoTo(a: { $stack: EdumediaElementStack[] }): void
    notifySearch(a: { $text: string }): void
    notifyAdd(): void
    //angular
    $on(event: string, func)
}


export const edumediaHeader = ng.directive('edumediaHeader', [function () {
    return {
        restrict: 'E',
        scope: {
            stack: "=",
            canAdd: "=",
            notifySearch: "&",
            notifyAdd: "&",
            notifyGoTo: "&"
        },
        template:
            `
        <div class="edumedia-header-stack" ng-if="isNotEmptyStack() || canShowAdd()">	
            <nav ng-style="{'visibility': isNotEmptyStack() ? 'visible' : 'hidden'}">
                <header><span ng-click="goTo(null)"><i18n>edumedia.theme</i18n></span></header>
                <header ng-repeat="item in stack"><span ng-click="goTo(item)">[[item.title]]</span></header>
            </nav>
        </div>
        <div class="edumedia-header-title">
            <h2>[[currentTitle()]]</h2>
        </div>
        <div class="edumedia-header-actions">
            <input type="search" ng-model="display.search" i18n-placeholder="search" ng-change="onSearchChange()">
            <button type="button" class="right-magnet" ng-disabled="!canAdd" ng-click="add()" ng-if="canShowAdd()">
                <i18n>add</i18n>
            </button>
        </div>
        `,
        link: function (scope: EdumediaHeaderScope, element, attributes) {
            scope.display = { search: "" }
            const searchSubject = new Subject<string>();
            const searchObs = searchSubject.debounceTime(300).distinctUntilChanged();
            const subscribtion = searchObs.subscribe(() => {
                scope.notifySearch({ $text: scope.display.search })
            })
            scope.$on("destroy", () => {
                subscribtion.unsubscribe();
            })
            scope.isNotEmptyStack = function () {
                return scope.stack && scope.stack.length > 0;
            }
            scope.currentTitle = function () {
                if (scope.isNotEmptyStack()) {
                    return scope.stack[scope.stack.length - 1].title;
                } else {
                    return idiom.translate("edumedia.choose");
                }
            }
            scope.canShowAdd = () =>{
                return scope.isNotEmptyStack() || scope.canAdd;
            }
            scope.onSearchChange = function () {
                searchSubject.next(scope.display.search);
            }
            scope.add = function () {
                scope.notifyAdd();
            }
            scope.goTo = (item) => {
                //reset search
                scope.display.search = "";
                scope.onSearchChange();
                //
                const index = scope.stack.findIndex((value) => value === item);
                if (index == -1) {
                    scope.stack = [];
                } else {
                    scope.stack = scope.stack.slice(0, index + 1)
                }
                setTimeout(() => scope.notifyGoTo({ $stack: scope.stack }))
            }
        }
    }
}])