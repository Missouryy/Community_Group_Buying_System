window.websocket = (function() {
    let groupBuySocket = null;
    let userNotificationSocket = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    /**
     * 初始化WebSocket连接
     */
    function init() {
        // 检查是否支持WebSocket
        if (!window.WebSocket) {
            console.warn('当前浏览器不支持WebSocket');
            return;
        }
        
        const tokens = window.api.getTokens();
        if (tokens.access) {
            // 用户已登录，连接个人通知WebSocket
            connectUserNotifications();
        }
        
        // 连接拼单更新WebSocket（无需登录）
        connectGroupBuyUpdates();
    }
    
    /**
     * 连接拼单更新WebSocket
     */
    function connectGroupBuyUpdates() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/groupbuys/`;
            
            groupBuySocket = new WebSocket(wsUrl);
            
            groupBuySocket.onopen = function(e) {
                console.log('拼单更新WebSocket连接已建立');
                reconnectAttempts = 0;
                
                // 显示连接状态（可选）
                showConnectionStatus('connected');
            };
            
            groupBuySocket.onmessage = function(e) {
                try {
                    const data = JSON.parse(e.data);
                    handleGroupBuyMessage(data);
                } catch (error) {
                    console.error('解析WebSocket消息失败:', error);
                }
            };
            
            groupBuySocket.onclose = function(e) {
                console.log('拼单更新WebSocket连接已关闭');
                showConnectionStatus('disconnected');
                
                // 尝试重连
                if (reconnectAttempts < maxReconnectAttempts) {
                    setTimeout(() => {
                        reconnectAttempts++;
                        console.log(`尝试重连拼单WebSocket (${reconnectAttempts}/${maxReconnectAttempts})`);
                        connectGroupBuyUpdates();
                    }, 3000 * reconnectAttempts);
                }
            };
            
            groupBuySocket.onerror = function(e) {
                console.error('拼单更新WebSocket错误:', e);
            };
            
        } catch (error) {
            console.error('连接拼单更新WebSocket失败:', error);
        }
    }
    
    /**
     * 连接用户通知WebSocket
     */
    function connectUserNotifications() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/notifications/`;
            
            userNotificationSocket = new WebSocket(wsUrl);
            
            userNotificationSocket.onopen = function(e) {
                console.log('用户通知WebSocket连接已建立');
            };
            
            userNotificationSocket.onmessage = function(e) {
                try {
                    const data = JSON.parse(e.data);
                    handleUserNotification(data);
                } catch (error) {
                    console.error('解析用户通知消息失败:', error);
                }
            };
            
            userNotificationSocket.onclose = function(e) {
                console.log('用户通知WebSocket连接已关闭');
                
                // 如果用户仍然登录，尝试重连
                const tokens = window.api.getTokens();
                if (tokens.access && reconnectAttempts < maxReconnectAttempts) {
                    setTimeout(() => {
                        reconnectAttempts++;
                        console.log(`尝试重连用户通知WebSocket (${reconnectAttempts}/${maxReconnectAttempts})`);
                        connectUserNotifications();
                    }, 3000 * reconnectAttempts);
                }
            };
            
            userNotificationSocket.onerror = function(e) {
                console.error('用户通知WebSocket错误:', e);
            };
            
        } catch (error) {
            console.error('连接用户通知WebSocket失败:', error);
        }
    }
    
    /**
     * 处理拼单更新消息
     */
    function handleGroupBuyMessage(data) {
        console.log('收到拼单更新:', data);
        
        switch (data.type) {
            case 'connection_established':
                console.log('拼单WebSocket连接建立:', data.message);
                break;
                
            case 'groupbuy_update':
                handleGroupBuyUpdate(data);
                break;
                
            case 'groupbuy_success':
                handleGroupBuySuccess(data);
                break;
                
            case 'new_groupbuy':
                handleNewGroupBuy(data);
                break;
                
            default:
                console.log('未知的拼单消息类型:', data.type);
        }
    }
    
    /**
     * 处理用户通知消息
     */
    function handleUserNotification(data) {
        console.log('收到用户通知:', data);
        
        switch (data.type) {
            case 'connection_established':
                console.log('用户通知WebSocket连接建立:', data.message);
                break;
                
            case 'order_update':
                handleOrderUpdate(data);
                break;
                
            case 'groupbuy_joined':
                handleGroupBuyJoined(data);
                break;
                
            case 'leader_notification':
                handleLeaderNotification(data);
                break;
                
            case 'system_notification':
                handleSystemNotification(data);
                break;
                
            default:
                console.log('未知的用户通知类型:', data.type);
        }
    }
    
    /**
     * 处理拼单更新
     */
    function handleGroupBuyUpdate(data) {
        const groupbuyId = data.groupbuy_id;
        const updateData = data.data;
        
        // 更新页面上的拼单信息
        const groupbuyCard = document.querySelector(`[data-groupbuy-id="${groupbuyId}"]`);
        if (groupbuyCard) {
            // 更新参团人数、进度等
            updateGroupBuyCard(groupbuyCard, updateData);
        }
        
        // 显示实时更新提示
        showNotificationToast('📦 拼单更新', `有人加入了拼单，当前进度已更新`, 'info');
    }
    
    /**
     * 处理拼单成功
     */
    function handleGroupBuySuccess(data) {
        const groupbuyId = data.groupbuy_id;
        
        // 显示成功通知
        showNotificationToast('🎉 拼单成功', `拼单已达成目标，即将安排发货！`, 'success');
        
        // 更新页面状态
        const groupbuyCard = document.querySelector(`[data-groupbuy-id="${groupbuyId}"]`);
        if (groupbuyCard) {
            groupbuyCard.classList.add('groupbuy-success');
            const statusBadge = groupbuyCard.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.textContent = '拼单成功';
                statusBadge.className = 'badge text-bg-success status-badge';
            }
        }
    }
    
    /**
     * 处理新拼单
     */
    function handleNewGroupBuy(data) {
        showNotificationToast('🆕 新拼单', '有新的拼单活动发布了，快来看看吧！', 'info');
        
        // 如果在首页，可以自动刷新拼单列表
        if (window.location.pathname === '/index.html' || window.location.pathname === '/') {
            if (typeof window.loadActiveGroupBuys === 'function') {
                setTimeout(() => {
                    window.loadActiveGroupBuys();
                }, 1000);
            }
        }
    }
    
    /**
     * 处理订单更新
     */
    function handleOrderUpdate(data) {
        const orderData = data.data;
        const orderId = orderData.order_id;
        const status = orderData.status;
        
        let title = '📦 订单更新';
        let message = orderData.message || `订单 #${orderId} 状态已更新`;
        let type = 'info';
        
        if (status === 'payment_success') {
            title = '💰 支付成功';
            type = 'success';
        } else if (status === 'groupbuy_success') {
            title = '🎉 拼单成功';
            type = 'success';
        } else if (status === 'ready_for_pickup') {
            title = '📦 可以提货';
            type = 'success';
        }
        
        showNotificationToast(title, message, type);
        
        // 更新订单页面
        if (window.location.pathname === '/orders.html') {
            if (typeof window.loadMyOrders === 'function') {
                setTimeout(() => {
                    window.loadMyOrders();
                }, 1000);
            }
        }
    }
    
    /**
     * 处理拼单加入通知
     */
    function handleGroupBuyJoined(data) {
        const joinData = data.data;
        showNotificationToast('👥 有人加入', `${joinData.joined_user} 加入了您关注的拼单`, 'info');
    }
    
    /**
     * 处理团长通知
     */
    function handleLeaderNotification(data) {
        showNotificationToast('👑 团长通知', data.data.message || '您有新的团长相关通知', 'warning');
    }
    
    /**
     * 处理系统通知
     */
    function handleSystemNotification(data) {
        showNotificationToast('🔔 系统通知', data.data.message || '您有新的系统通知', 'primary');
    }
    
    /**
     * 显示通知提示
     */
    function showNotificationToast(title, message, type = 'info') {
        // 创建通知容器（如果不存在）
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        // 创建通知元素
        const toastId = `toast-${Date.now()}`;
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast align-items-center text-bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <div class="fw-semibold">${title}</div>
                    <div class="small">${message}</div>
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>`;
        
        toastContainer.appendChild(toast);
        
        // 显示通知
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 5000
        });
        bsToast.show();
        
        // 自动移除元素
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
    
    /**
     * 显示连接状态
     */
    function showConnectionStatus(status) {
        // 优先使用统一导航系统的状态显示
        if (window.navSystem && window.navSystem.setWebSocketStatus) {
            window.navSystem.setWebSocketStatus(status, status === 'connected' ? '实时连接' : '连接断开');
        } else {
            // 回退到原有方式
            const statusElement = document.getElementById('websocket-status');
            if (statusElement) {
                if (status === 'connected') {
                    statusElement.innerHTML = '<span class="text-success small">● 实时连接</span>';
                } else {
                    statusElement.innerHTML = '<span class="text-muted small">○ 连接断开</span>';
                }
            }
        }
    }
    
    /**
     * 更新拼单卡片
     */
    function updateGroupBuyCard(card, data) {
        // 更新参团人数
        const currentParticipants = card.querySelector('.current-participants');
        if (currentParticipants && data.current_participants) {
            currentParticipants.textContent = data.current_participants;
        }
        
        // 更新进度条
        const progressBar = card.querySelector('.progress-bar');
        if (progressBar && data.progress) {
            progressBar.style.width = `${data.progress}%`;
            progressBar.textContent = `${data.progress}%`;
        }
        
        // 添加更新动画
        card.classList.add('card-updated');
        setTimeout(() => {
            card.classList.remove('card-updated');
        }, 1000);
    }
    
    /**
     * 加入拼单房间
     */
    function joinGroupBuyRoom(groupbuyId) {
        if (groupBuySocket && groupBuySocket.readyState === WebSocket.OPEN) {
            groupBuySocket.send(JSON.stringify({
                type: 'join_groupbuy',
                groupbuy_id: groupbuyId
            }));
        }
    }
    
    /**
     * 离开拼单房间
     */
    function leaveGroupBuyRoom(groupbuyId) {
        if (groupBuySocket && groupBuySocket.readyState === WebSocket.OPEN) {
            groupBuySocket.send(JSON.stringify({
                type: 'leave_groupbuy',
                groupbuy_id: groupbuyId
            }));
        }
    }
    
    /**
     * 断开WebSocket连接
     */
    function disconnect() {
        if (groupBuySocket) {
            groupBuySocket.close();
            groupBuySocket = null;
        }
        
        if (userNotificationSocket) {
            userNotificationSocket.close();
            userNotificationSocket = null;
        }
    }
    
    // 页面卸载时断开连接
    window.addEventListener('beforeunload', disconnect);
    
    return {
        init,
        joinGroupBuyRoom,
        leaveGroupBuyRoom,
        disconnect,
        showNotificationToast
    };
})();

// 页面加载完成后自动初始化WebSocket
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，让其他脚本先加载
    setTimeout(() => {
        window.websocket.init();
    }, 1000);
});
