import { Component, ChangeDetectorRef } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MenuItemFormGroup } from '../services/app-form-group.service';
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { Observable, of as observableOf } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { SelectionModel } from '@angular/cdk/collections';
import { FileDatabase, FileFlatNode } from '../services/file-database.service';
import { FileNode } from '../models/file-node.model';
import { MenuItem } from '../models/app.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [FileDatabase]
})

export class AppComponent{
  fg: FormGroup;
  treeControl: FlatTreeControl<FileFlatNode>;
  treeFlattener: MatTreeFlattener<FileNode, FileFlatNode>;
  dataSource: MatTreeFlatDataSource<FileNode, FileFlatNode>;
  // expansion model tracks expansion state
  expansionModel = new SelectionModel<string>(true);
  dragging = false;
  expandTimeout: any;
  expandDelay = 1000;
  validateDrop = false;
  buttonText = 'ADD';
  tempNode: FileNode
  isEditMode = false;

  private _getLevel = (node: FileFlatNode) => node.level;
  private _isExpandable = (node: FileFlatNode) => node.expandable;
  private _getChildren = (node: FileNode): Observable<FileNode[]> => observableOf(node.children);
  hasChild = (_: number, _nodeData: FileFlatNode) => _nodeData.expandable;

  constructor(database: FileDatabase, private appFormGroup: MenuItemFormGroup, private cdr: ChangeDetectorRef) {
    this.treeFlattener = new MatTreeFlattener(this.transformer, this._getLevel,
      this._isExpandable, this._getChildren);
    this.treeControl = new FlatTreeControl<FileFlatNode>(this._getLevel, this._isExpandable);
    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

    database.dataChange.subscribe(data => this.rebuildTreeForData(data));
  }

  ngOnInit(): void {
    this.fg = this.appFormGroup.getFormGroup();
  }


  onAdd() {
    const data: MenuItem = this.appFormGroup.getValueFromFormGroup(this.fg);
    const node = new FileNode();
    node.filename = data.name;
    node.link = data.link;
    node.id = `0/${this.dataSource._data.value.length}`;
    if (data.hasChildren) {
      node.children = [];
    }
    this.dataSource._data.value.push(node);
    this.rebuildTreeForData(this.dataSource._data.value);
    localStorage.setItem('data',JSON.stringify(this.dataSource._data.value))
  }

  onEdit(node: FileNode) {
    this.buttonText = "Edit";
    this.fg.patchValue({
      name: node.filename,
      link: node.link
    });
    this.tempNode = node;
    this.isEditMode = true;
    this.cdr.detectChanges();
  }

  onEditSubmitted() {
    const newData: MenuItem = this.appFormGroup.getValueFromFormGroup(this.fg);
    this.updateData(this.dataSource._data.value, this.tempNode, newData)

    this.rebuildTreeForData(this.dataSource._data.value);
    this.buttonText = 'Add';
    this.isEditMode = false;
    this.fg.reset();
    this.cdr.detectChanges();
    localStorage.setItem('data',JSON.stringify(this.dataSource._data.value))
  }

  updateData(data: FileNode[], node: FileNode, newData: MenuItem) {
    data.forEach((item, i) => {
      if (item.id === node.id) {
        item.filename = newData.name;
        item.link = newData.link;
      } else if (item.children) {
        this.updateData(item.children, node, newData);
      }
    });
  }


  onDelete(node: FileNode) {
    this.deleteData(this.dataSource._data.value, node)
    this.rebuildTreeForData(this.dataSource._data.value);
    localStorage.setItem('data',JSON.stringify(this.dataSource._data.value))
  }

  deleteData(data: FileNode[], node: FileNode) {
    data.forEach((item, i) => {
      if (item.id === node.id) {
        data = data.splice(i, 1);
      } else if (item.children) {
        this.deleteData(item.children, node);
      }
    });
  }


  getAddButtonClasses() {
    if (this.fg.valid) {
      return 'full-width p-1 bg-primary center text-white'
    }
    else return 'full-width p-1 center text-white'
  }


  transformer = (node: FileNode, level: number) => {
    return new FileFlatNode(!!node.children, node.filename, level, node.type, node.id, node.link);
  }



  /**
   * This constructs an array of nodes that matches the DOM
   */
  visibleNodes(): FileNode[] {
    const result = [];

    function addExpandedChildren(node: FileNode, expanded: string[]) {
      result.push(node);
      if (expanded.includes(node.id)) {
        node.children.map((child) => addExpandedChildren(child, expanded));
      }
    }
    this.dataSource.data.forEach((node) => {
      addExpandedChildren(node, this.expansionModel.selected);
    });
    return result;
  }

  /**
   * Handle the drop - here we rearrange the data based on the drop event,
   * then rebuild the tree.
   * */
  drop(event: CdkDragDrop<string[]>) {

    // ignore drops outside of the tree
    if (!event.isPointerOverContainer) return;

    // construct a list of visible nodes, this will match the DOM.
    // the cdkDragDrop event.currentIndex jives with visible nodes.
    // it calls rememberExpandedTreeNodes to persist expand state
    const visibleNodes = this.visibleNodes();

    // deep clone the data source so we can mutate it
    const changedData = JSON.parse(JSON.stringify(this.dataSource.data));

    // recursive find function to find siblings of node
    function findNodeSiblings(arr: Array<any>, id: string): Array<any> {
      let result, subResult;
      arr.forEach((item, i) => {
        if (item.id === id) {
          result = arr;
        } else if (item.children) {
          subResult = findNodeSiblings(item.children, id);
          if (subResult) result = subResult;
        }
      });
      return result;

    }

    // determine where to insert the node
    const nodeAtDest = visibleNodes[event.currentIndex];
    const newSiblings = findNodeSiblings(changedData, nodeAtDest.id);
    if (!newSiblings) return;
    const insertIndex = newSiblings.findIndex(s => s.id === nodeAtDest.id);

    // remove the node from its old place
    const node = event.item.data;
    const siblings = findNodeSiblings(changedData, node.id);
    const siblingIndex = siblings.findIndex(n => n.id === node.id);
    const nodeToInsert: FileNode = siblings.splice(siblingIndex, 1)[0];
    if (nodeAtDest.id === nodeToInsert.id) return;

    // ensure validity of drop - must be same level
    const nodeAtDestFlatNode = this.treeControl.dataNodes.find((n) => nodeAtDest.id === n.id);
    if (this.validateDrop && nodeAtDestFlatNode.level !== node.level) {
      alert('Items can only be moved within the same level.');
      return;
    }

    // insert node 
    newSiblings.splice(insertIndex, 0, nodeToInsert);

    // rebuild tree with mutated data
    this.rebuildTreeForData(changedData);
    localStorage.setItem('data',JSON.stringify(this.dataSource._data.value))
  }

  /**
   * Experimental - opening tree nodes as you drag over them
   */
  dragStart() {
    this.dragging = true;
  }
  dragEnd() {
    this.dragging = false;
  }
  dragHover(node: FileFlatNode) {
    if (this.dragging) {
      clearTimeout(this.expandTimeout);
      this.expandTimeout = setTimeout(() => {
        this.treeControl.expand(node);
      }, this.expandDelay);
    }
  }
  dragHoverEnd() {
    if (this.dragging) {
      clearTimeout(this.expandTimeout);
    }
  }

  /**
   * The following methods are for persisting the tree expand state
   * after being rebuilt
   */

  rebuildTreeForData(data: any) {
    this.dataSource.data = data;
    this.expansionModel.selected.forEach((id) => {
      const node = this.treeControl.dataNodes.find((n) => n.id === id);
      this.treeControl.expand(node);
    });
  }

}


