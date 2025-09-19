<template>
    <div>
        <div class="form-group">
            <label :for="fields.id">{{ fields.promptText }}</label>
            <select class="form-control" :class="validationClass" :id="fields.id" @change="callAction($event.target)" :required="fields.valueRequired" v-model="fields.currentValue">
                <option v-for="option in fields.valueOptions" :key="option.id">{{ option }}</option>
            </select>
            <div class="invalid-feedback">
                The field {{fields.promptText}} is required.
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'PromptDropDown',
    props: {
        fields: {
            type: Object,
            required: true
        }
    }, 
    methods: {
        callAction(target) {
            if(this.fields.valueRequired && this.fields.currentValue == '') {
                this.validated = false;
                target.focus();
            } else {
                this.validated = true;
                this.$emit('changed', target);
            }
        }
    },
    computed: {
        validationClass() {
            return !this.validated ? 'is-invalid' : '';
        }
    },
    data() {
        return {
            validated: true
        }

    }
}
</script>

<style lang="scss" scoped>

</style>