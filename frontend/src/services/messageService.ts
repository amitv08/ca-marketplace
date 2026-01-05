import api from './api';

export interface SendMessageData {
  receiverId: string;
  requestId?: string;
  content: string;
  file?: File;
}

const messageService = {
  // Send message with optional file attachment
  sendMessage: async (data: SendMessageData) => {
    const formData = new FormData();
    formData.append('receiverId', data.receiverId);
    formData.append('content', data.content);
    if (data.requestId) formData.append('requestId', data.requestId);
    if (data.file) formData.append('file', data.file);

    const response = await api.post('/messages', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get messages for a service request
  getMessagesByRequestId: async (requestId: string) => {
    const response = await api.get(`/messages/${requestId}`);
    return response.data;
  },

  // Mark message as read
  markAsRead: async (messageId: string) => {
    const response = await api.put(`/messages/${messageId}/read`);
    return response.data;
  },

  // Get all conversations
  getConversations: async () => {
    const response = await api.get('/messages/conversations');
    return response.data;
  },

  // Get unread message count
  getUnreadCount: async () => {
    const response = await api.get('/messages/unread/count');
    return response.data;
  },
};

export default messageService;
