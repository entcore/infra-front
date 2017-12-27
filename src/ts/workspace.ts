import { Behaviours } from './behaviours';
import { moment } from './libs/moment/moment';
import { _ } from './libs/underscore/underscore';
import { notify } from './notify';
import { idiom as lang } from './idiom';
import http from 'axios';
import { Eventer, Mix, Selection, Selectable } from 'entcore-toolkit';
import { model } from './modelDefinitions';
import { Rights, Shareable } from './rights';

const maxFileSize = parseInt(lang.translate('max.file.size'));

class Quota {
    max: number;
    used: number;
    unit: string;

    constructor() {
        this.max = 1;
        this.used = 0;
        this.unit = 'Mo'
    }

    appropriateDataUnit(bytes: number) {
        var order = 0
        var orders = {
            0: lang.translate("byte"),
            1: "Ko",
            2: "Mo",
            3: "Go",
            4: "To"
        }
        var finalNb = bytes
        while (finalNb >= 1024 && order < 4) {
            finalNb = finalNb / 1024
            order++
        }
        return {
            nb: finalNb,
            order: orders[order]
        }
    }

    async refresh (): Promise<void> {
        const response = await http.get('/workspace/quota/user/' + model.me.userId);
        const data = response.data;
        //to mo
        data.quota = data.quota / (1024 * 1024);
        data.storage = data.storage / (1024 * 1024);

        if (data.quota > 2000) {
            data.quota = Math.round((data.quota / 1024) * 10) / 10;
            data.storage = Math.round((data.storage / 1024) * 10) / 10;
            this.unit = 'Go';
        }
        else {
            data.quota = Math.round(data.quota);
            data.storage = Math.round(data.storage);
        }

        this.max = data.quota;
        this.used = data.storage;
    }
};

export let quota = new Quota();

export class Revision{
}

export enum DocumentStatus{
    initial = 'initial', loaded = 'loaded', failed = 'failed', loading = 'loading'
}

export class Document implements Selectable, Shareable {
    title: string;
    _id: string;
    created: any;
    path: string;
    metadata: {
        'content-type'?: string,
		role?: string,
        extension?: string,
        filename?: string,
        size?: number
    } = {};
    newProperties: {
        name?: string;
        legend?: string;
        alt?: string
    } = {};
	version: number;
	link: string;
	icon: string;
	owner: {
        userId: string,
        displayName: string
    };
    eventer = new Eventer();
    revisions: Revision[];
    status: DocumentStatus;
    selected: boolean;
    currentQuality: number;
    hiddenBlob: Blob;
    rights: Rights<Document> = new Rights(this);
    private xhr: XMLHttpRequest;
    shared: any;
    alt: string;
    legend: string;

    get myRights(){
        return this.rights.myRights;
    }

    async delete(){
        await http.delete('/workspace/document/' + this._id);
    }

    abort(){
        if(this.xhr){
            this.xhr.abort();
        }
    }

    get size(): string{
        const koSize = this.metadata.size / 1024;
        if(koSize > 1024){
            return (parseInt(koSize / 1024 * 10) / 10)  + ' Mo';
        }
        return Math.ceil(koSize) + ' Ko';
    }

    async loadProperties(){
        const response = await http.get(`/workspace/document/properties/${ this._id }`);
        var dotSplit = response.data.name.split('.');
        this.metadata.extension = dotSplit[dotSplit.length - 1];
        if (dotSplit.length > 1) {
            dotSplit.length = dotSplit.length - 1;
        }
        
        this.title = dotSplit.join('.');
        this.newProperties.name = this.title;
        this.metadata.role = this.role();
    }

    async saveChanges(){
        this.title = this.newProperties.name;
        this.alt = this.newProperties.alt;
        this.legend = this.newProperties.legend;
        await http.put('/workspace/rename/document/' + this._id, this.newProperties);
        await this.applyBlob();
    }

    async applyBlob(){
        if(this.hiddenBlob){
            await this.update(this.hiddenBlob);
        }
    }

    fromJSON(data) {
        if(!data){
            this.status = DocumentStatus.initial;
            return;
        }

        this.status = DocumentStatus.loaded;
        this.newProperties.alt = this.alt;
        this.newProperties.legend = this.legend;
        if (data.metadata) {
            var dotSplit = data.metadata.filename.split('.');
            this.metadata.extension = dotSplit[dotSplit.length - 1];
            if (dotSplit.length > 1) {
                dotSplit.length = dotSplit.length - 1;
            }
            
            this.title = dotSplit.join('.');
            this.newProperties.name = this.title;
			this.metadata.role = this.role();
        }

        if (data.created) {
            this.created = moment(data.created.split('.')[0]);
        }
		else if(data.sent){
			this.created = moment(data.sent.split('.')[0]);
        }
        else {
            this.created = moment();
        }

		this.owner = { userId: data.owner, displayName: data.ownerName };

		this.version = parseInt(Math.random() * 100);
		this.link = '/workspace/document/' + this._id;
		if(this.metadata && this.metadata.role === 'img'){
			this.icon = this.link;
		}
		this.revisions = [];
    }

	async refreshHistory(){
        const response = await http.get("document/" + this._id + "/revisions");
        const revisions = response.data;
        this.revisions = Mix.castArrayAs(Revision, revisions);
    }

    get isEditableImage(){
        const editables = ['jpg', 'jpeg', 'bmp', 'png'];
        const ext = this.metadata.extension.toLowerCase();
        return editables.indexOf(ext) !== -1;
    }

    upload(file: File | Blob, visibility?: 'public' | 'protected' | 'owner'): Promise<any> {
        var visibilityPath = '';
        if (!visibility) {
            visibility = 'protected';
        }
        if(visibility === 'public' || visibility === 'protected'){
            visibilityPath = visibility + '=true&application=media-library&';
        }
        if(!this.metadata || !this.metadata.extension){
            const nameSplit = file.name.split('.');
            this.metadata = { 
                'content-type': file.type,
                'filename': file.name,
                size: file.size,
                extension: nameSplit[nameSplit.length - 1]
            };
            this.metadata.role = this.role();
        }
        this.status = DocumentStatus.loading;
        var formData = new FormData();
        formData.append('file', file, file.name);
        this.title = file.name;
        this.newProperties.name = this.title;
        this.xhr = new XMLHttpRequest();
        this.xhr.open('POST', '/workspace/document?' + visibilityPath + 'quality=1&' + MediaLibrary.thumbnails);
        this.xhr.send(formData);
        this.xhr.onprogress = (e) => {
            this.eventer.trigger('progress', e);
        }

        return new Promise((resolve, reject) => {
            this.xhr.onload = () => {
                if(this.xhr.status >= 200 && this.xhr.status < 400){
                    this.eventer.trigger('loaded');
                    this.status = DocumentStatus.loaded;
                    const result = JSON.parse(this.xhr.responseText);
                    this._id = result._id;
                    if(this.path){
                        http.put("documents/move/" + this._id + '/' + encodeURIComponent(this.path)).then(() => {
                            resolve();
                        });
                    }
                    else{
                        resolve();
                    }
                }
                else{
                    if(this.xhr.status === 413){
                        notify.error(lang.translate('file.too.large.limit') + (maxFileSize / 1024 / 1024) + lang.translate('mb'));
                    }
                    else{
                        
                        var error = JSON.parse(this.xhr.responseText);
                        notify.error(error.error);
                    }
                    this.eventer.trigger('error');
                    this.status = DocumentStatus.failed;
                }
            }
        });
    }

    role() {
        return Document.role(this.metadata['content-type']);
    }

    protectedDuplicate(callback?: (document: Document) => void): Promise<Document> {
        return new Promise((resolve, reject) => {
            Behaviours.applicationsBehaviours.workspace.protectedDuplicate(this, function (data) {
                resolve(Mix.castAs(Document, data));
            });
        });
    }

    publicDuplicate(callback?: (document: Document) => void) {
        return new Promise((resolve, reject) => {
            Behaviours.applicationsBehaviours.workspace.publicDuplicate(this, function (data) {
                resolve(Mix.castAs(Document, data));
            });
        });
    }

    async update(blob: Blob){
        const formData = new FormData();
        formData.append('file', blob, this.title + '.' + this.metadata.extension);
        await http.put(`/workspace/document/${this._id}?${MediaLibrary.thumbnails}&quality=1`, formData);
        this.currentQuality = 1;
        this.version = Math.floor(Math.random() * 100);
        this.eventer.trigger('save');
    }

    static role(fileType) {
        if (!fileType)
            return 'unknown'

        var types = {
            'doc': function (type) {
                return type.indexOf('document') !== -1 && type.indexOf('wordprocessing') !== -1;
            },
            'xls': function (type) {
                return (type.indexOf('document') !== -1 && type.indexOf('spreadsheet') !== -1) || (type.indexOf('ms-excel') !== -1);
            },
            'img': function (type) {
                return type.indexOf('image') !== -1;
            },
            'pdf': function (type) {
                return type.indexOf('pdf') !== -1 || type === 'application/x-download';
            },
            'ppt': function (type) {
                return (type.indexOf('document') !== -1 && type.indexOf('presentation') !== -1) || type.indexOf('powerpoint') !== -1;
            },
            'video': function (type) {
                return type.indexOf('video') !== -1;
            },
            'audio': function (type) {
                return type.indexOf('audio') !== -1;
            },
            'zip': function (type) {
                return type.indexOf('zip') !== -1 ||
                    type.indexOf('rar') !== -1 ||
                    type.indexOf('tar') !== -1 ||
                    type.indexOf('7z') !== -1;
            }
        };

        for (let type in types) {
            if (types[type](fileType)){
                return type;
            }
        }

        return 'unknown';
    }

    async trash(): Promise<any> {
        const response = await http.put('/workspace/document/trash/' + this._id);
    }
}

export class Folder implements Selectable{

    selected: boolean;
    folders = new Selection<Folder>([]);
    documents = new Selection<Document>([]);
    folder: string;

    closeFolder(){
        this.folders.all = [];
    };
    
    async sync(){
        this.folders.all.splice(0, this.folders.all.length);
        this.folders.addRange(MediaLibrary.myDocuments.folders.filter((folder) => folder.folder.indexOf(this.folder + '_') !== -1));
        const response = await http.get('/workspace/documents/' + this.folder + '?filter=owner&hierarchical=true');
        this.documents.all.splice(0, this.documents.all.length);
        this.documents.addRange(Mix.castArrayAs(Document, response.data.filter(doc => doc.folder !== 'Trash')));
        MediaLibrary.eventer.trigger('sync');
    }
}

export class MyDocuments extends Folder{
    async sync(){
        this.folders.all.splice(0, this.folders.all.length);
        const response = await http.get('/workspace/folders/list?filter=owner');
        this.folders.addRange(response.data.filter((folder) => folder.folder.indexOf('_') === -1 ));
        this.documents.all.splice(0, this.documents.all.length);
        const docResponse = await http.get('/workspace/documents?filter=owner&hierarchical=true');
        this.documents.addRange(Mix.castArrayAs(Document, docResponse.data.filter(doc => doc.folder !== 'Trash')));
        MediaLibrary.eventer.trigger('sync');
    }
}

class SharedDocuments extends Folder{
    async sync(){
        this.documents.all.splice(0, this.documents.all.length);
        const docResponse = await http.get('/workspace/documents?filter=shared');
        this.documents.addRange(Mix.castArrayAs(Document, docResponse.data.filter(doc => doc.folder !== 'Trash')));
        MediaLibrary.eventer.trigger('sync');
    }
}

class AppDocuments extends Folder{
    async sync(){
        this.documents.all.splice(0, this.documents.all.length);
        const docResponse = await http.get('/workspace/documents?filter=protected');
        this.documents.addRange(Mix.castArrayAs(Document, docResponse.data.filter(doc => doc.folder !== 'Trash')));
        MediaLibrary.eventer.trigger('sync');
    }
}

class PublicDocuments extends Folder{
    async sync(){
        this.documents.all.splice(0, this.documents.all.length);
        const docResponse = await http.get('/workspace/documents?filter=public');
        this.documents.addRange(Mix.castArrayAs(Document, docResponse.data.filter(doc => doc.folder !== 'Trash')));
        MediaLibrary.eventer.trigger('sync');
    }
}

export class MediaLibrary{
    static myDocuments = new MyDocuments();
    static sharedDocuments = new SharedDocuments();
    static appDocuments = new AppDocuments();
    static publicDocuments = new PublicDocuments();
    static eventer = new Eventer();

    static thumbnails = "thumbnail=120x120&thumbnail=150x150&thumbnail=100x100&thumbnail=290x290&thumbnail=48x48&thumbnail=82x82&thumbnail=381x381&thumbnail=1600x0";

    static async upload (file: File | Blob, visibility?: 'public' | 'protected'): Promise<Document>{
        if(!visibility){
            visibility = 'protected';
        }

        const doc = new Document();
        await doc.upload(file, visibility);
        return doc;
    }
}

if (!window.entcore) {
    window.entcore = {};
}
window.entcore.Folder = Folder;
window.entcore.quota = quota;
window.entcore.Document = Document;
window.entcore.MediaLibrary = MediaLibrary;
window.entcore.DocumentStatus = DocumentStatus;