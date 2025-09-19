<template>
    <div id="app" class="container">
        <loading :active.sync="isLoading" 
        :is-full-page="fullPage"></loading>
        <nav class="navbar navbar-expand-lg navbar-light bg-light mb-5">
            <div class="form-group">
                <label for="productSelection">Select Demonstration Product</label>
                <select class="form-control" id="productSelection" v-model="currentProduct" @change="openProduct()">
                    <option v-for="product in products" :key="product.id" :value="product.id">{{ product.productName }}</option>
                </select>
            </div>
        </nav>
        <div class="row justify-content-center">
            <div :class="hasProductImage.classImage" v-if="hasProductImage.classImage">
                <img :src="hasProductImage.image" class="product-image">
            </div>
            <div :class="hasProductImage.classPrompt">
                <div v-for="prompt of prompts" :key="prompt.id">
                    <PromptNumber :fields="prompt" v-if="prompt.promptType == 'Number'" @changed="updateProduct($event)" />
                    <PromptDropDown :fields="prompt" v-if="prompt.promptType == 'DropDown'" @changed="updateProduct($event)" />
                    <PromptTextBox :fields="prompt" v-if="prompt.promptType == 'TextBox'" @changed="updateProduct($event)" />
                    <PromptImagePicker :fields="prompt" v-if="prompt.promptType == 'ImagePicker'" @changed="updateProduct($event)" />
                    <PromptColorPicker :fields="prompt" v-if="prompt.promptType == 'ColorPicker'" @changed="updateProduct($event)" />
                    <PromptDate :fields="prompt" v-if="prompt.promptType == 'Date'" @changed="updateProduct($event)" />
                </div>
                <hr v-if="currentProduct">
                <ul class="list-unstyled">
                    <li class="h3" v-if="this.totalPrice">
                        {{'$' + parseFloat(this.totalPrice.value.replace(',', '.')).toFixed(2)}}
                    </li>
                    <li class="small" v-for="output of outputValuesPrint" :key="output.name"> 
                        {{ output.name }} ({{ output.type }}): {{ output.value }}
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>

<script>
import PromptNumber from './components/shared/promptModels/PromptNumber.vue';
import PromptDropDown from './components/shared/promptModels/PromptDropDown.vue';
import PromptTextBox from './components/shared/promptModels/PromptTextBox.vue';
import PromptImagePicker from './components/shared/promptModels/PromptImagePicker.vue';
import PromptColorPicker from './components/shared/promptModels/PromptColorPicker.vue';
import PromptDate from './components/shared/promptModels/PromptDate.vue';
import Loading from 'vue-loading-overlay';
import 'vue-loading-overlay/dist/vue-loading.css';

const axios = require('axios');
const API_URL = 'https://api.easyquote.cloud/api/v1'

export default {
    name: 'App',
    components: {
        PromptNumber,
        PromptDropDown,
        PromptTextBox,
        PromptImagePicker,
        PromptColorPicker,
        PromptDate,
        Loading
    },

    computed: {
        outputValuesPrint() {
            return this.outputValues ? this.outputValues.filter(ov => ov.type != 'Price' && ov.type != 'ProductImage') : '';
        },
        hasProductImage() {
            if(this.outputValues) {
                let productImage = this.outputValues.filter(ov => ov.type == 'ProductImage');
                if(productImage.length > 0) {
                    return {
                        image: productImage[0].value,
                        classImage: 'col-6 col-sm-4',
                        classPrompt: 'col-12 col-sm-8'
                    };
                }
            }
            return {
                image: '',
                classImage: '',
                classPrompt: 'col-12'
            };
        }
    },

    methods: {
        openProduct() {
            this.isLoading = true;
            axios.get(`${API_URL}/pricing/${this.currentProduct}`, this.headerToken)
            .then(response => {
                this.prompts = response.data.prompts;
                this.outputValues = response.data.outputValues;
                this.totalPrice = this.outputValues.filter(function(elem){
                    return elem.type == "Price";
                });
                this.totalPrice = this.totalPrice[0];
                this.isLoading = false;
            })
            .catch(error => {
                console.log(error);
                this.isLoading = false;
            });
        }, 
        updateProduct(event) {
            if(event.value) {
                this.isLoading = true;
                let updateItems = [];
                this.prompts.forEach(function(item) {
                    if(item.id == event.id) {
                        item.currentValue = event.value;
                    }
                    updateItems.push({
                        id: item.id,
                        value: item.currentValue
                    });
                });

                axios.patch(`${API_URL}/pricing/${this.currentProduct}`, updateItems, this.headerToken)
                .then(response => {
                    this.prompts = response.data.prompts;
                    this.outputValues = response.data.outputValues;
                    this.totalPrice = this.outputValues.filter(function(elem){
                        return elem.type == "Price";
                    });
                    this.totalPrice = this.totalPrice[0];
                    this.isLoading = false;
                })
                .catch(error => {
                    console.log(error);
                    this.isLoading = false;
                });
            }
        },

        init() {
            this.isLoading = true;
            let user = {
                "password": "test1",
                "email": "test1@test1.com"
            }

            axios.post(`${API_URL}/users/authenticate`, user)
                .then(response => {
                    this.headerToken = {
                        headers: {
                            'Authorization': 'Bearer ' + response.data.token
                        }
                    }
                    this.listProducts();
                    this.isLoading = false;
                })
                .catch(error => {
                    console.log(error);
                    this.isLoading = false;
                });
        },

        listProducts() {
            this.isLoading = true;
            axios.get(`${API_URL}/products`, this.headerToken)
                .then(response => {
                    this.products = response.data;
                    this.outputValues = response.data.outputValues;
                    this.isLoading = false;
                })
                .catch(error => {
                    console.log(error);
                    this.isLoading = false;
                });
        }
    },

    data() {
        return {
            products: '',
            outputValues: '',
            prompts: '',
            currentProduct: '',
            headerToken: '',
            totalPrice: '',
            isLoading: false,
            fullPage: true
        }
    },

    mounted() {
        this.init();
    }

}
</script>

<style lang="scss">
@import './assets/styles/_variables';
@import './assets/styles/_bootstrap';

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin-top: 60px;
}

.image-output {
    width: 100%;
    margin-top: 10px;
}

.form-control:disabled, .form-control[readonly] {
    background-color: #ffffff !important;
}

.product-image {
    width: 100%;
}
</style>
