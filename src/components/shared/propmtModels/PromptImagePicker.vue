<template>
    <div>
        <div class="form-group">
            <label :for="fields.id">{{ fields.promptText }}</label>
            <ul class="list-group list-group-horizontal row m-0">
                <li class="list-group-item col-4 col-md-2 mr-md-3 mb-3" v-for="image in fields.valueOptions" :key="image.id" :class="{selectedImage: image == fields.currentValue}">
                    <img :src="image" alt="" :id="fields.id" :value="image" @click="selectImage(image, $event.target)">
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
export default {
    name: 'PromptImagePicker',
    props: {
        fields: {
            type: Object,
            required: true
        }
    },
    methods: {
        selectImage(image, target) {
            if(this.fields.currentValue != image) {
                this.fields.currentValue = image;
                let retorno = {
                    id: target.id,
                    value: image,
                    required: this.fields.valueRequired
                }
                this.$emit('changed', retorno);
            }
        }
    }
}
</script>

<style lang="scss" scoped>
 img {
     width: 100%;
 }

 .selectedImage {
     border: 2px solid #0088cc !important;
 }
</style>