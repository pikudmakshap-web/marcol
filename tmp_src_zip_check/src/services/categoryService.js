import api from './api';

export const getCategories = async () => {
    const response = await api.get('/categories');
    return response.data;
};

export const createCategory = async (data) => {
    const response = await api.post('/categories', data);
    return response.data;
};

export const deleteCategory = async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
};
