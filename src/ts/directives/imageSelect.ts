import { ng } from '../ng-start';
import { MediaLibrary, Document } from '../workspace';

export let imageSelect = ng.directive('imageSelect', function(){
	return {
		restrict: 'E',
		transclude: true,
		scope: {
			ngModel: '=',
			thumbnails: '&',
			ngChange: '&',
			default: '@'
		},
		template: `<div><img ng-src="[[ngModel + '?' + getThumbnails()]]" class="pick-file" draggable="false" ng-if="ngModel" style="cursor: pointer" />
			<i class="trash" ng-click="restoreDefault()"></i>
			<i class="edit pick-file"></i>
			<img skin-src="[[default]]" class="pick-file" draggable="false" ng-if="!ngModel" style="cursor: pointer" />
			<lightbox show="userSelecting">
			<media-library 
				visibility="selectedFile.visibility"
				ng-change="updateDocument()" 
				ng-model="selectedFile.file"
				file-format="'img'">
			</media-library>
			</lightbox>'
			</div>`,
		link: function(scope, element, attributes){
			scope.selectedFile = { file: {}, visibility: 'protected' };

			scope.selectedFile.visibility = scope.$parent.$eval(attributes.visibility);
			if(!scope.selectedFile.visibility){
				scope.selectedFile.visibility = 'protected';
			}
			scope.selectedFile.visibility = scope.selectedFile.visibility.toLowerCase();

			scope.restoreDefault = () => {
				setTimeout(() => {
					scope.ngModel = '';
					scope.$apply();
					scope.ngChange();
					scope.$apply();
				}, 10);
			};

			element.on('dragenter', (e) => {
				e.preventDefault();
			});

			element.on('dragstart', 'img', (e) => {
				e.preventDefault();
			})

			element.on('dragover', (e) => {
				element.addClass('droptarget');
				e.preventDefault();
			});

			element.on('dragleave', () => {
				element.removeClass('droptarget');
			});

			element.on('drop', async (e) => {
				element.removeClass('droptarget');
				element.addClass('loading-panel');
				e.preventDefault();
				var file = e.originalEvent.dataTransfer.files[0];
				const doc = new Document();
				await doc.upload(file, scope.selectedFile.visibility);
				scope.selectedFile.file = doc;
				scope.updateDocument();
				element.removeClass('loading-panel');
				MediaLibrary.appDocuments.sync();
			});

			scope.$watch('thumbnails', (thumbs) => {
				var evaledThumbs = scope.$eval(thumbs);
				if(!evaledThumbs){
					return;
				}
				scope.getThumbnails = () => {
					var link = '';
					evaledThumbs.forEach((th) =>{
						link += 'thumbnail=' + th.width + 'x' + th.height + '&';
					});
					return link;
				}
			});

			scope.updateDocument = () => {
				setTimeout(() => {
					scope.userSelecting = false;
					var path = '/workspace/document/';
					if(scope.selectedFile.visibility === 'public'){
						path = '/workspace/pub/document/'
					}
					scope.ngModel = path + scope.selectedFile.file._id;
					scope.$apply();
					scope.ngChange();
				}, 10);
			};
			element.on('click', '.pick-file', () => {
				scope.userSelecting = true;
				scope.$apply();
			});
		}
	}
});