import { FormGroup, Validators, FormBuilder } from '@angular/forms';
import { Injectable } from '@angular/core';
import { MenuItem } from '../models/app.model';

@Injectable({
    providedIn: 'root',
})

export class MenuItemFormGroup {
    constructor(private fb: FormBuilder) { }

    getFormGroup(data?: MenuItem): FormGroup {
        return this.fb.group({
            name: [data?.name, [Validators.required, Validators.maxLength(50), Validators.minLength(6)]],
            link: [data?.link, [Validators.required, Validators.minLength(10), Validators.maxLength(50)]],
            hasChildren: [data?.hasChildren],
        }
        );
    }

    getValueFromFormGroup(fg: FormGroup): MenuItem {
        return {
            name: fg.controls.name.value,
            link: fg.controls.link.value,
            hasChildren: fg.controls.hasChildren.value,
        };
    }
}
