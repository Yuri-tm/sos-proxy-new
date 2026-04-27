import { useState, useEffect } from 'react';
import Head from 'next/head';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, CheckCircle, XCircle, ExternalLink, Search, Clock, Server, Wifi, WifiOff, CircleDot, Copy } from 'lucide-react';
import styles from '../styles/Home.module.css';
import type { ProxyRecord, ProxyStatus } from '../lib/types';
import { STATUS_TRANSLATION } from '../lib/types';

interface Proxy {
    url: string;
    status: 'доступен' | 'недоступен' | 'в процессе проверки';
    lastChecked: string;
}

type Tab = 'все' | 'доступен' | 'недоступен' | 'в процессе проверки';

function translateStatus(status: ProxyStatus | string): Proxy['status'] {
    return (STATUS_TRANSLATION[status as ProxyStatus] || status) as Proxy['status'];
}

function normalizeProxyRecords(data: unknown): Proxy[] {
    const apiProxies = Array.isArray(data) ? data : ((data as { proxies?: unknown })?.proxies ?? []);
    if (!Array.isArray(apiProxies)) return [];

    return apiProxies.map((proxy) => {
        const record = proxy as Partial<ProxyRecord>;
        return {
            url: typeof record.url === 'string' ? record.url : '',
            status: translateStatus(typeof record.status === 'string' ? record.status : 'pending'),
            lastChecked: typeof record.lastChecked === 'string' ? record.lastChecked : new Date(0).toISOString(),
        };
    }).filter((proxy) => proxy.url);
}

function getServerHost(proxyUrl: string): string {
    try {
        const normalized = /^https?:\/\/t\.me\/proxy\b/i.test(proxyUrl)
            ? proxyUrl.replace(/^https?:\/\/t\.me\/proxy\b/i, 'tg://proxy')
            : proxyUrl;
        const url = new URL(normalized.replace('tg://proxy', 'http://temp.host'));
        return url.searchParams.get('server') || 'unknown';
    } catch {
        return 'unknown';
    }
}

export default function ProxyBlog() {
    const [proxies, setProxies] = useState<Proxy[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [tab, setTab] = useState<Tab>('доступен');
    const [query, setQuery] = useState('');

    const availableCount = proxies.filter((proxy) => proxy.status === 'доступен').length;
    const unavailableCount = proxies.filter((proxy) => proxy.status === 'недоступен').length;
    const pendingCount = proxies.filter((proxy) => proxy.status === 'в процессе проверки').length;

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/get-proxies');
            const contentType = res.headers.get('content-type') || '';
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`get-proxies failed: ${res.status} ${text.slice(0, 200)}`);
            }
            if (!contentType.includes('application/json')) {
                const text = await res.text().catch(() => '');
                throw new Error(`get-proxies not JSON: ${text.slice(0, 200)}`);
            }

            const data = await res.json();
            setProxies(normalizeProxyRecords(data));
        } catch (err) {
            console.error("Ошибкa при получении прокси", err);
            setProxies([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckAvailability = async () => {
        setUpdating(true);
        try {
            // Затем запускаем пинг
            const pingRes = await fetch('/api/check-ping');
            if (!pingRes.ok) {
                const text = await pingRes.text().catch(() => '');
                throw new Error(`Ошибкa при проверке пинга: ${pingRes.status} ${text.slice(0, 200)}`);
            }
            await fetchData();
        } catch (err) {
            console.error("Ошибкa при обновлении", err);
        } finally {
            setUpdating(false);
        }
    };

    const handleRefetch = async () => {
        setUpdating(true);
        try {
            const res = await fetch('/api/cron-fetch');
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`Ошибкa при обновлении cron: ${res.status} ${text.slice(0, 200)}`);
            }
            await fetchData();
        } catch (err) {
            console.error("Ошибкa при обновлении", err);
        } finally {
            setUpdating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Ссылка скопирована в буфер обмена!");
    };

    const normalizedQuery = query.trim().toLowerCase();
    const filtered = proxies
        .filter((p) => {
            if (tab === 'все') return true;
            return p.status === tab;
        })
        .filter((p) => {
            if (!normalizedQuery) return true;
            const host = getServerHost(p.url).toLowerCase();
            return host.includes(normalizedQuery);
        });

    useEffect(() => {
        let cancelled = false;

        const loadInitialData = async () => {
            try {
                const res = await fetch('/api/get-proxies');
                const contentType = res.headers.get('content-type') || '';
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    throw new Error(`get-proxies failed: ${res.status} ${text.slice(0, 200)}`);
                }
                if (!contentType.includes('application/json')) {
                    const text = await res.text().catch(() => '');
                    throw new Error(`get-proxies not JSON: ${text.slice(0, 200)}`);
                }

                const data = await res.json();
                if (!cancelled) {
                    setProxies(normalizeProxyRecords(data));
                }
            } catch (err) {
                console.error("Failed to fetch proxies", err);
                if (!cancelled) setProxies([]);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void loadInitialData();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className={styles.page}>
            <Head>
                <title>Прокси серверы Telegram</title>
                <meta name="description" content="Свежие прокси MTProto для Telegram" />
            </Head>

            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div>
                        <p className={styles.eyebrow}>MTProto</p>
                        <h1 className={styles.title}>Бесплатные прокси для Telegram</h1>
                        <p className={styles.subtitle}>
                            Список обновляется автоматически. Нажмите на ссылку или сканируйте QR-код для подключения напрямую в Telegram.
                        </p>
                    </div>
                </div>
            </header>

            <main className={styles.main}>
                <section className={styles.summaryBar}>
                    <div className={styles.summaryPane}>
                        <div className={styles.summaryStats}>
                            <div className={styles.summaryItem}>
                                <span className={`${styles.summaryIconWrap} ${styles.summaryIconTotal}`}>
                                    <Server size={15} />
                                </span>
                                <span className={styles.summaryValue}>{proxies.length}</span>
                                <span className={styles.summaryLabel}>всего</span>
                            </div>
                            <div className={styles.summaryItem}>
                                <span className={`${styles.summaryIconWrap} ${styles.summaryIconAvailable}`}>
                                    <Wifi size={15} />
                                </span>
                                <span className={styles.summaryValue}>{availableCount}</span>
                                <span className={styles.summaryLabel}>доступных</span>
                            </div>
                            <div className={styles.summaryItem}>
                                <span className={`${styles.summaryIconWrap} ${styles.summaryIconUnavailable}`}>
                                    <WifiOff size={15} />
                                </span>
                                <span className={styles.summaryValue}>{unavailableCount}</span>
                                <span className={styles.summaryLabel}>недоступных</span>
                            </div>
                            <div className={`${styles.summaryItem} ${styles.summaryItemPending}`}>
                                <span className={styles.pendingPulse} aria-hidden="true" />
                                <span className={`${styles.summaryIconWrap} ${styles.summaryIconPending}`}>
                                    <CircleDot size={15} />
                                </span>
                                <span className={styles.summaryValue}>{pendingCount}</span>
                                <span className={styles.summaryLabel}>в ожидании</span>
                            </div>
                        </div>

                        <div className={styles.summaryActions}>
                            <button
                                onClick={handleRefetch}
                                disabled={updating}
                                className={styles.ghostButton}
                            >
                                <RefreshCw className={updating ? styles.spinning : ''} size={18} />
                                Обновить список
                            </button>
                            <button
                                onClick={handleCheckAvailability}
                                disabled={updating || proxies.length === 0}
                                className={`${styles.ghostButton} ${styles.primaryButton}`}
                            >
                                <Wifi size={18} />
                                Проверить доступность
                            </button>
                        </div>
                    </div>
                </section>

                <section className={styles.panel}>
                    <div className={styles.panelTop}>
                        <div className={styles.tabs}>
                            <button
                                type="button"
                                className={`${styles.tab} ${tab === 'все' ? styles.tabActive : ''}`}
                                onClick={() => setTab('все')}
                            >
                                Все
                            </button>
                            <button
                                type="button"
                                className={`${styles.tab} ${tab === 'доступен' ? styles.tabActive : ''}`}
                                onClick={() => setTab('доступен')}
                            >
                                Доступные
                            </button>
                            <button
                                type="button"
                                className={`${styles.tab} ${tab === 'в процессе проверки' ? styles.tabActive : ''}`}
                                onClick={() => setTab('в процессе проверки')}
                            >
                                Не проверено
                            </button>
                        </div>
                    </div>

                    <div className={styles.panelBottom}>
                        <div className={styles.muted}>Показано {filtered.length} из {proxies.length} прокси</div>
                    </div>
                </section>

                {loading && proxies.length === 0 ? (
                    <div className={styles.loading}>
                        <div>Загружаю прокси...</div>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {filtered.map((proxy, idx) => (
                            <article key={idx} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <span className={`${styles.status} ${proxy.status === 'доступен' ? styles.available :
                                        proxy.status === 'недоступен' ? styles.unavailable : styles.pending
                                        }`}>
                                        {proxy.status === 'доступен' ? <CheckCircle size={12} /> : proxy.status === 'недоступен' ? <XCircle size={12} /> : <Clock size={12} />}
                                        {proxy.status}
                                    </span>
                                    <span className={styles.time}>
                                        {new Date(proxy.lastChecked).toLocaleString()}
                                    </span>
                                </div>

                                <div className={styles.qrWrap}>
                                    <QRCodeSVG value={proxy.url} size={140} includeMargin={true} />
                                </div>

                                <button
                                    type="button"
                                    className={styles.proxyMeta}
                                    onClick={() => copyToClipboard(proxy.url)}
                                    aria-label={`Скопировать ссылку прокси ${getServerHost(proxy.url)}`}
                                >
                                    <span className={styles.proxyMetaTop}>
                                        <span className={`${styles.proxyMetaLabel} ${styles.serverName}`}>{getServerHost(proxy.url)}</span>
                                        <span className={styles.proxyMetaIcon} aria-hidden="true">
                                            <Copy size={15} />
                                        </span>
                                    </span>
                                    <span className={styles.proxyMetaValue}>{proxy.url}</span>
                                </button>

                                <div className={styles.actions}>
                                    <a
                                        href={proxy.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.actionPrimary}
                                    >
                                        <ExternalLink size={16} /> Подключиться
                                    </a>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {!loading && proxies.length === 0 && (
                    <div className={styles.empty}>
                        <p>Прокси не найдены. Нажмите "Обновить список", чтобы получить данные.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
