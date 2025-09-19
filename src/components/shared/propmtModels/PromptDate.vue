<template>
    <div>
        <div class="form-group">
            <label :for="fields.id">{{ fields.promptText }}</label>
            <date-picker input-class="form-control" v-model="fields.currentValue" format="M/D/YYYY" :id="fields.id" 
                @change="callAction()" :required="fields.valueRequired"
                :disabled-date="invalidDates" valueType="YYYY-MM-DD" 
                :clearable="false" :editable="false"></date-picker>
        </div>
    </div>
</template>

<script>
import DatePicker from 'vue2-datepicker';
import 'vue2-datepicker/index.css';
import moment from 'moment';

let startDateRange;
let endDateRange;

export default {
    name: 'PromptDate',
    props: {
        fields: {
            type: Object,
            required: true
        }
    }, 
    components: {
        DatePicker
    },
    methods: {
        callAction() {
            let target = {
                id: this.fields.id,
                value: moment(this.fields.currentValue).format('YYYY-MM-DD')
            }
            this.$emit('changed', target);
        },
        invalidDates(date) {
            if (moment(date).isBefore(startDateRange)) {
                return true;
            } 
            if(moment(date).isAfter(endDateRange)) {
                return true;
            }
            return false;
        }
    },
    mounted() {
        startDateRange = moment(this.fields.currentValue).add( this.fields.minDaysToAdd, 'days');
        endDateRange = moment(this.fields.currentValue).add(this.fields.maxDaysToAdd, 'days');
    }
}
</script>

<style lang="scss" scoped>
.mx-datepicker {
    display: block;
    width: 100%;
}
</style>