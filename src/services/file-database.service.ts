import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FileNode } from '../models/file-node.model';

@Injectable()
export class FileDatabase {
    dataChange = new BehaviorSubject<FileNode[]>([]);

    get data(): FileNode[] { return this.dataChange.value; }

    constructor() {
        this.initialize();
    }

    initialize() {
        let data;
        if (localStorage.getItem('data')) {
            data = JSON.parse(localStorage.getItem('data'));
        }
        else {
            const dataObject = JSON.parse(TREE_DATA);
            data = this.buildFileTree(dataObject, 0);
        }

        this.dataChange.next(data);
    }

    /**
     * Build the file structure tree. The `value` is the Json object, or a sub-tree of a Json object.
     * The return value is the list of `FileNode`.
     */
    buildFileTree(obj: { [key: string]: any }, level: number, parentId: string = '0'): FileNode[] {
        return Object.keys(obj).reduce<FileNode[]>((accumulator, key, idx) => {
            const value = obj[key];
            const node = new FileNode();
            node.filename = key;
            /**
             * Make sure your node has an id so we can properly rearrange the tree during drag'n'drop.
             * By passing parentId to buildFileTree, it constructs a path of indexes which make
             * it possible find the exact sub-array that the node was grabbed from when dropped.
             */
            node.id = `${parentId}/${idx}`;

            if (value != null) {
                if (typeof value === 'object') {
                    node.children = this.buildFileTree(value, level + 1, node.id);
                } else {
                    node.type = value;
                }
            }

            return accumulator.concat(node);
        }, []);
    }

}

export class FileFlatNode {
    constructor(
        public expandable: boolean,
        public filename: string,
        public level: number,
        public type: any,
        public id: string,
        public link: string
    ) { }
}


const TREE_DATA = JSON.stringify({
    Applications: {
        Calendar: 'app',
        Chrome: 'app',
    },
});