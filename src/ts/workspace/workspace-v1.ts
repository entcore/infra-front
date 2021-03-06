import { _ } from '../libs/underscore/underscore';
import { idiom as lang } from '../idiom';
import http from 'axios';
import { Eventer, Selection, Selectable } from 'entcore-toolkit';
import { model } from '../modelDefinitions';
import * as workspaceModel from "./model"
import { workspaceService } from "./services";
//
let xsrfCookie;
if (document.cookie) {
    let cookies = _.map(document.cookie.split(';'), function (c) {
        return {
            name: c.split('=')[0].trim(),
            val: c.split('=')[1].trim()
        };
    });
    xsrfCookie = _.findWhere(cookies, { name: 'XSRF-TOKEN' });
}

export class Quota {
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

    async refresh(): Promise<void> {
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

export class Revision implements workspaceModel.Revision {
    _id?: string
    documentId: string
}

export enum DocumentStatus {
    initial = 'initial', loaded = 'loaded', failed = 'failed', loading = 'loading'
}

export class Document extends workspaceModel.Element {
    isNew: boolean = false;
    async delete() {
        await workspaceService.deleteAll([this]);
    }

    abort() {
        super.abortUpload();
    }

    get size(): string {
        const koSize = this.metadata.size / 1024;
        if (koSize > 1024) {
            return (parseInt(koSize / 1024 * 10) / 10) + ' Mo';
        }
        return Math.ceil(koSize) + ' Ko';
    }

    async loadProperties() {
        const response = await http.get(`/workspace/document/properties/${this._id}`);
        var dotSplit = response.data.name.split('.');
        this.metadata = this.metadata || {};
        this.metadata.extension = dotSplit[dotSplit.length - 1];
        if (dotSplit.length > 1) {
            dotSplit.length = dotSplit.length - 1;
        }

        this.alt = response.data.alt;
        this.newProperties.alt = response.data.alt;
        this.legend = response.data.legend;
        this.newProperties.legend = response.data.legend;
        this.title = dotSplit.join('.');
        this.newProperties.name = response.data.name.replace('.' + this.metadata.extension, '');
        this.metadata.role = this.role();
    }

    /**
     * used by image editor
     */
    async saveChanges() {
        this.applyNewProperties();
        await this.applyBlob();
    }
    /**
     * used by image editor
     */
    async applyBlob() {
        if (this.hiddenBlob) {
            await workspaceService.updateDocument(this.hiddenBlob, this);
            this.hiddenBlob = undefined;
        }
    }
    async refreshHistory() {
        await workspaceService.syncHistory(this);
    }

    upload(file: File | Blob, visibility?: 'public' | 'protected' | 'owner', application = "media-library", parent?: workspaceModel.Element): Promise<workspaceModel.Element> {
        this.isNew = true;
        visibility = (visibility === "public" || visibility === "protected") ? visibility : null
        return workspaceService.createDocument(file, this, parent, { visibility, application });
    }

    async protectedDuplicate(callback?: (document: Document) => void): Promise<Document> {
        const temp = await workspaceService.copyDocumentWithVisibility(this, { visibility: "protected", application: "media-library" });
        callback && callback(temp);
        return temp;
    }

    async publicDuplicate(callback?: (document: Document) => void) {
        const temp = await workspaceService.copyDocumentWithVisibility(this, { visibility: "public", application: "media-library" });
        callback && callback(temp);
        return temp;
    }

    async update(blob: Blob) {
        let newName = this.name || this.title;
        if (newName.indexOf(this.metadata.extension) === -1) {
            newName += '.' + this.metadata.extension;
        }
        this.name = newName;
        await workspaceService.updateDocument(blob, this)
        this.currentQuality = 1;
        this.version = Math.floor(Math.random() * 100);
        this.eventer.trigger('save');
    }


    async trash(): Promise<any> {
        return workspaceService.trashAll([this]);
    }
}
export class Folder implements Selectable {
    _id: string;
    eParent: string;
    selected: boolean;
    name: string = "";
    folders = new Selection<Folder>([]);
    documents = new Selection<Document>([]);
    owner: string;
    filter: workspaceModel.TREE_NAME;
    private _newModel:workspaceModel.Element;
    constructor(filter: workspaceModel.TREE_NAME, f?: workspaceModel.Element) {
        this.filter = filter;
        if (f) {
            this._id = f._id;
            this.eParent = f.eParent;
            this.owner = f.ownerName;
            this.name = f.name || "";
            for (let child of f.children) {
                this.folders.push(new Folder(this.filter, child))
            }
        }
        this._newModel = new workspaceModel.Element({_id:this._id});
    }
    get isChildrenLoading(){
        return this._newModel.isChildrenLoading;
    }
    get isDocumentLoading(){
        return this._newModel.isDocumentLoading;
    }
    get isChildrenOrDocumentLoading(){
        return this._newModel.isChildrenOrDocumentLoading;
    }
    canExpand(){
        if(workspaceService.isLazyMode()){
            return this.folders.all.length > 0 || this._newModel.cacheChildren.isEmpty;
        }
        return this.folders.all.length > 0;
    }
    setChildren(children: workspaceModel.Element[]) {
        for (let child of children) {
            this.folders.push(new Folder(this.filter, child))
        }
    }
    setChildrenFromTree(tree: workspaceModel.Tree){
        this.setChildren(tree.children);
        if(tree instanceof workspaceModel.ElementTree){
            this._newModel = tree;
        }
    }
    deselectAll() {
        this.documents.forEach(d => d.selected = false);
        this.folders.all.forEach(f => f.deselectAll());
    }

    closeFolder() {
        this.folders.all = [];
    }

    isOpened(currentFolder: Folder) {
        return currentFolder && (//
            (currentFolder._id === this._id)//
            || currentFolder === this//
        );
    }

    isOpenedRecursive(currentFolder: Folder) {
        if (this.isOpened(currentFolder)) {
            return true;
        }
        return this.folders.filter((f: Folder) => {
            return f.isOpenedRecursive(currentFolder);
        }).length > 0;
    }

    async sync() {
        if(workspaceService.isLazyMode()){            
            const response = await (this._newModel instanceof workspaceModel.ElementTree?
                                    workspaceService.fetchChildrenForRoot(this._newModel, { filter: this.filter, parentId: this._id || "" }):
                                    workspaceService.fetchChildren(this._newModel, { filter: this.filter, parentId: this._id || "" }));
            this.documents.all.splice(0, this.documents.all.length);
            this.documents.addRange(response);
            this.folders.all.splice(0, this.folders.all.length);
            this.folders.addRange(this._newModel.cacheChildren.data.map(f=>new Folder(this.filter, f)));
            MediaLibrary.eventer.trigger('sync');
        }else{
            const response = await workspaceService.fetchDocuments({ filter: this.filter, parentId: this._id || "" });
            this.documents.all.splice(0, this.documents.all.length);
            this.documents.addRange(response);
            MediaLibrary.eventer.trigger('sync');
        }
    }
}

export class MyDocuments extends Folder {
    constructor() {
        super("owner")
    }
    async sync() {
        if(workspaceService.isLazyMode()){
            return super.sync();
        }
        const response = await workspaceService.fetchDocuments({ filter: "owner", parentId: this._id || "" });
        this.documents.all.splice(0, this.documents.all.length);
        this.documents.addRange(response);
        MediaLibrary.eventer.trigger('sync');
    }
}

export class SharedDocuments extends Folder {
    constructor() {
        super("shared")
    }
    async sync() {
        if(workspaceService.isLazyMode()){
            return super.sync();
        }
        const response = await workspaceService.fetchDocuments({ filter: "shared", parentId: this._id || "" });
        this.documents.all.splice(0, this.documents.all.length);
        this.documents.addRange(response);
        MediaLibrary.eventer.trigger('sync');
    }
}

export class AppDocuments extends Folder {
    constructor() {
        super("protected")
    }
    async sync() {
        if(workspaceService.isLazyMode()){
            //return super.sync(); => no lazy mode in app documents => always refresh (can add ...)
        }
        const response = await workspaceService.fetchDocuments({ filter: "protected", parentId: this._id || "" });
        this.documents.all.splice(0, this.documents.all.length);
        this.documents.addRange((response))
        MediaLibrary.eventer.trigger('sync');
    }
}

export class PublicDocuments extends Folder {
    constructor() {
        super("public")
    }
    async sync() {
        if(workspaceService.isLazyMode()){
            //return super.sync(); => no lazy mode in public documents => always refresh (can add....)
        }
        const docResponse = await workspaceService.fetchDocuments({ filter: "public", parentId: this._id || "" })
        this.documents.all.splice(0, this.documents.all.length);
        this.documents.addRange(docResponse);
        MediaLibrary.eventer.trigger('sync');
    }
}

export class MediaLibrary {
    static synchronized = false;
    static myDocuments = new MyDocuments();
    static sharedDocuments = new SharedDocuments();
    static appDocuments = new AppDocuments();
    static externalDocuments = new AppDocuments();
    static publicDocuments = new PublicDocuments();
    static trashDocuments = new Folder("trash");
    static eventer = new Eventer();

    static async sync() {
        if (MediaLibrary.synchronized) {
            return;
        }
        try {
            MediaLibrary.synchronized = true;
            const trees = await workspaceService.fetchTrees({ filter: "all", hierarchical: true })
            for (let tree of trees) {
                switch (tree.filter) {
                    case 'owner':
                        MediaLibrary.myDocuments.setChildrenFromTree(tree);
                        break;
                    case 'protected':
                        MediaLibrary.appDocuments.setChildrenFromTree(tree);
                        break;
                    case 'public':
                        MediaLibrary.publicDocuments.setChildrenFromTree(tree);
                        break;
                    case 'shared':
                        MediaLibrary.sharedDocuments.setChildrenFromTree(tree);
                        break;
                    case 'trash':
                        MediaLibrary.trashDocuments.setChildrenFromTree(tree);
                        break;
                    case 'external':
                        MediaLibrary.externalDocuments.setChildrenFromTree(tree);
                        break;
                }
            }
            MediaLibrary.eventer.trigger("ready")
        } catch (e) {
            MediaLibrary.synchronized = false;
        }
    }
    static deselectAll() {
        MediaLibrary.appDocuments.deselectAll();
        MediaLibrary.sharedDocuments.deselectAll();
        MediaLibrary.myDocuments.deselectAll();
    }

    static async upload(file: File | Blob, visibility?: 'public' | 'protected'): Promise<Document> {
        if (!visibility) {
            visibility = 'protected';
        }

        const doc = new Document();
        await doc.upload(file, visibility);
        return doc;
    }
}
