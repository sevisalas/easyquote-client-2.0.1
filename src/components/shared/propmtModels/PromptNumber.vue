<template>
    <div>
        <div class="form-group">
            <label :for="fields.id">{{ fields.promptText }}</label>
            <input type="number" class="form-control" :class="validationClass" :id="fields.id" :max="fields.maximum" :min="fields.minimum" v-model="fields.currentValue"  @blur="callAction($event.target)" :required="fields.valueRequired" :step="step">
            <div class="invalid-feedback">
                {{ validateMessage }}
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'PromptNumber',
    props: {
        fields: {
            type: Object,
            required: true
        }
    }, 
    methods: {
        callAction(target) {
            if(!this.validate()) {
                this.validated = false;
                target.focus();
            } else {
                this.validated = true;
                this.$emit('changed', target);
            }
        },
        validate() {
            if((this.fields.currentValue * this.multiplier) % 1 !== 0) {
                if(this.fields.allowedDecimals > 0) {
                    this.validateMessage = 'The field ' + this.fields.promptText + ' must have only ' + this.fields.allowedDecimals + ' decimal positions.';
                } else {
                    this.validateMessage = 'The value of field ' + this.fields.promptText + ' must be an integer.';
                }
                return false;
            }
            if(this.fields.valueRequired && this.fields.currentValue === '') {
                this.validateMessage = 'The field ' + this.fields.promptText + ' is required.'
                return false;
            }
            if(this.fields.currentValue < this.fields.minimum || this.fields.currentValue > this.fields.maximum) {
                this.validateMessage = 'The value of field ' + this.fields.promptText + ' must be between ' + this.fields.minimum + ' and ' + this.fields.maximum + '.';
                return false;
            }
            return true;
        }
    },
    computed: {
        validationClass() {
            return !this.validated ? 'is-invalid' : '';
        },
        step() {
            return 1/this.multiplier;
        }
    },
    data() {
        return {
            validated: true,
            validateMessage: '',
            multiplier: Math.pow(10,this.fields.allowedDecimals)
        }

    }
}
</script>

<style lang="scss" scoped>

</style>