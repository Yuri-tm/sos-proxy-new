export type ProxyStatus = 'available' | 'unavailable' | 'pending';

export interface ProxyRecord {
    url: string;
    status: ProxyStatus;
    lastChecked: string;
}

export const STATUS_TRANSLATION: Record<ProxyStatus, string> = {
    available: 'доступен',
    unavailable: 'недоступен',
    pending: 'в процессе проверки',
} as const;