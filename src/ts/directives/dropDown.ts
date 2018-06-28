import { ng } from '../ng-start';
import { idiom } from '../idiom';
import { $ } from "../libs/index";

export const dropDown = ng.directive('dropDown', ['$compile', '$timeout', ($compile, $timeout) => {
	return {
		restrict: 'E',
		scope: {
			options: '=',
			ngChange: '&',
			onClose: '&',
			ngModel: '='
		},
		template: `
			<div data-drop-down class="drop-down">
				<div>
					<ul class="ten cell right-magnet">
						<li ng-repeat="option in options | limitTo:limit" ng-model="option">
							<a class="cell" ng-class="{'sharebookmark': option.type === 'sharebookmark'}">
								<i class="add-favorite cell" ng-if="option.type === 'sharebookmark'"></i>
								[[option.name]][[option.displayName]]
							</a>
							<em class="left-spacing top-spacing-twice low-importance cell">[[translate(option.profile)]] </em>
						</li>
						<li class="display-more" ng-show="limit < options.length" ng-click="increaseLimit()">[[translate('seemore')]]</li>
					</ul>
				</div>
			</div>
		`,
		link: function(scope, element, attributes){
			scope.translate = idiom.translate;
			scope.limit = 6;
			var dropDown = element.find('[data-drop-down]');
			scope.setDropDownHeight = function(){
				var liHeight = 0;
				var max = Math.min(scope.limit, scope.options.length);
				dropDown.find('li').each(function(index, el){
					liHeight += $(el).height();
					return index < max;
				});
				dropDown.height(liHeight)
			};
			scope.increaseLimit = function(){
				scope.limit += 5;
				$timeout(function(){
					scope.setDropDownHeight()
				});
			};
			scope.positionOptions = function() {
				if(!scope.options || scope.options.length === 0){
					dropDown.height();
					dropDown.addClass('hidden');
					scope.limit = 6;
					dropDown.attr('style', '');
					return;
				}
				dropDown.removeClass('hidden');
				var linkedInput = (!attributes.for) ? element.parent() : $('#' + attributes.for);
				var pos = linkedInput.offset();
				var width = linkedInput.width() +
					parseInt(linkedInput.css('padding-right')) +
					parseInt(linkedInput.css('padding-left')) +
					parseInt(linkedInput.css('border-width') || 1) * 2;
				var height = linkedInput.height() +
					parseInt(linkedInput.css('padding-top')) +
					parseInt(linkedInput.css('padding-bottom')) +
					parseInt(linkedInput.css('border-height') || 1) * 2;

				pos.top = pos.top + height;
				dropDown.offset(pos);
				dropDown.width(width);
				scope.setDropDownHeight();
				setTimeout(function(){
					scope.setDropDownHeight()
				}, 100);
			}
			scope.$watchCollection('options', function(newValue){
				scope.positionOptions();
			});

			dropDown.detach().appendTo('body');

			dropDown.on('click', 'li', async function(e){
				if($(e.target).hasClass('display-more')){
					return;
				}
				scope.limit = 6;
				if (attributes.for) {
					dropDown.attr('style', '');
				}
				else {
					scope.positionOptions();
				}
				scope.current = $(this).scope().option;
				scope.ngModel = $(this).scope().option;
				scope.$apply('ngModel');
				await scope.ngChange();
				scope.$eval(scope.onClose);
				scope.$apply('ngModel');
			});

			var closeDropDown = function(e){
				if(dropDown.find(e.target).length > 0){
					return;
				}
				scope.$eval(scope.onClose);
				scope.$apply();
			};

			$('body').on('click', closeDropDown);
			dropDown.attr('data-opened-drop-down', true);
			element.on('$destroy', function(){
				$('body').unbind('click', closeDropDown);
				dropDown.remove();
			});
		}
	}
}]);
