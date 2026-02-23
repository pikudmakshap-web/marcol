import api from './api';

export const getProducts = async (params) => {
    const response = await api.get('/products', { params });
    return response.data;
};

export const createProduct = async (productData) => {
    
    const response = await api.post('/products', productData);
    return response.data;
};

export const updateProduct = async (id, productData) => {
    const response = await api.put(`/products/${id}`, productData);
    return response.data;
};

export const deleteProduct = async (id) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
};

export const getProductByBarcode = async (barcode) => {
    const response = await api.get(`/products/barcode/${barcode}`);
    return response.data;
};
