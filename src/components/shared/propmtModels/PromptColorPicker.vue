<template>
    <div>
        <div class="form-group">
            <label :for="fields.id">{{ fields.promptText }}</label>
            <ul class="list-group list-group-horizontal">
                <li class="list-group-item col-md-1 mr-3 h-100" v-for="color in fields.valueOptions" :key="color.id" :id="fields.id" @click="selectColor(color, $event.target)" :class="{selectedColor: color == fields.currentValue}"  :style="{background: '#'+color}">
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
export default {
    name: 'PromptColorPicker',
    props: {
        fields: {
            type: Object,
            required: true
        }
    },
    methods: {
        selectColor(color, target) {
            if(this.fields.currentValue != color) {
                this.fields.currentValue = color;
                let retorno = {
                    id: target.id,
                    value: color,
                    required: this.fields.valueRequired
                }
                this.$emit('changed', retorno);
            }
        }
    }
}
</script>

<style lang="scss" scoped>
    .selectedColor {
        border: 2px solid #0088cc !important;
    }
    
    .list-group-horizontal > .list-group-item + .list-group-item {
        border-left-width: 1px
    }

    .list-group-item:after{
        display:block;
        content:"";
        padding-top:100%;
    }
</style>