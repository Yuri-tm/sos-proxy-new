import { useState, useEffect } from 'react';
import Head from 'next/head';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, RefreshCw, CheckCircle, XCircle, ExternalLink, Search, Clock } from 'lucide-react';
import styles from '../styles/Home.module.css';

interface Proxy {
    url: string;
    status: 'available' | 'unavailable' | 'pending';
    lastChecked: string;
}

type Tab = 'all' | 'available' | 'unavailable' | 'pending';

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
    const [tab, setTab] = useState<Tab>('all');
    const [query, setQuery] = useState('');

    const availableCount = proxies.filter((proxy) => proxy.status === 'available').length;
    const unavailableCount = proxies.filter((proxy) => proxy.status === 'unavailable').length;
    const pendingCount = proxies.filter((proxy) => proxy.status === 'pending').length;

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
            const proxies = Array.isArray(data) ? data : (data?.proxies ?? []);
            setProxies(proxies || []);
        } catch (err) {
            console.error("Failed to fetch proxies", err);
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
                throw new Error(`check-ping failed: ${pingRes.status} ${text.slice(0, 200)}`);
            }
            await fetchData();
        } catch (err) {
            console.error("Update failed", err);
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
                throw new Error(`cron-fetch failed: ${res.status} ${text.slice(0, 200)}`);
            }
            await fetchData();
        } catch (err) {
            console.error("Refetch failed", err);
        } finally {
            setUpdating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Link copied to clipboard!");
    };

    const normalizedQuery = query.trim().toLowerCase();
    const filtered = proxies
        .filter((p) => {
            if (tab === 'all') return true;
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
                const proxies = Array.isArray(data) ? data : (data?.proxies ?? []);
                if (!cancelled) {
                    setProxies(proxies || []);
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
                <title>Telegram Proxy Servers</title>
                <meta name="description" content="Fresh Telegram MTProto Proxies" />
            </Head>

            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div>
                        <p className={styles.eyebrow}>MTProto Proxy Directory</p>
                        <h1 className={styles.title}>Telegram Proxy Servers</h1>
                        <p className={styles.subtitle}>
                            Live-updated list of MTProto proxy servers. Click any link or scan the QR code to connect directly in Telegram.
                        </p>
                    </div>
                    <div className={styles.actionsInline}>
                        <button
                            onClick={handleRefetch}
                            disabled={updating}
                            className={styles.ghostButton}
                        >
                            <RefreshCw className={updating ? styles.spinning : ''} size={18} />
                            Refetch list
                        </button>
                        <button
                            onClick={handleCheckAvailability}
                            disabled={updating || proxies.length === 0}
                            className={`${styles.ghostButton} ${styles.primaryButton}`}
                        >
                            <CheckCircle size={18} />
                            Check availability
                        </button>
                    </div>
                </div>
            </header>

            <main className={styles.main}>
                <section className={styles.summaryBar}>
                    <div className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>total</span>
                        <span className={styles.summaryValue}>{proxies.length}</span>
                    </div>
                    <div className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>available</span>
                        <span className={styles.summaryValue}>{availableCount}</span>
                    </div>
                    <div className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>unavailable</span>
                        <span className={styles.summaryValue}>{unavailableCount}</span>
                    </div>
                    <div className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>pending</span>
                        <span className={styles.summaryValue}>{pendingCount}</span>
                    </div>
                </section>

                <section className={styles.panel}>
                    <div className={styles.panelTop}>
                        <div className={styles.tabs}>
                            <button
                                type="button"
                                className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`}
                                onClick={() => setTab('all')}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                className={`${styles.tab} ${tab === 'available' ? styles.tabActive : ''}`}
                                onClick={() => setTab('available')}
                            >
                                Available
                            </button>
                            <button
                                type="button"
                                className={`${styles.tab} ${tab === 'unavailable' ? styles.tabActive : ''}`}
                                onClick={() => setTab('unavailable')}
                            >
                                Unavailable
                            </button>
                            <button
                                type="button"
                                className={`${styles.tab} ${tab === 'pending' ? styles.tabActive : ''}`}
                                onClick={() => setTab('pending')}
                            >
                                Unchecked
                            </button>
                        </div>

                        <div className={styles.searchWrap}>
                            <Search size={16} className={styles.searchIcon} />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by host..."
                                className={styles.searchInput}
                                aria-label="Search by host"
                            />
                        </div>
                    </div>

                    <div className={styles.panelBottom}>
                        <div className={styles.muted}>Showing {filtered.length} of {proxies.length} proxies</div>
                        <div className={styles.muted}>
                            Source: <a href="https://github.com/Grim1313/mtproto-for-telegram" target="_blank" rel="noreferrer">github.com/Grim1313/mtproto-for-telegram</a>
                        </div>
                    </div>
                </section>

                {loading && proxies.length === 0 ? (
                    <div className={styles.loading}>
                        <div>Loading proxies...</div>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {filtered.map((proxy, idx) => (
                            <article key={idx} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <span className={`${styles.status} ${proxy.status === 'available' ? styles.available :
                                            proxy.status === 'unavailable' ? styles.unavailable : styles.pending
                                        }`}>
                                        {proxy.status === 'available' ? <CheckCircle size={12} /> : proxy.status === 'unavailable' ? <XCircle size={12} /> : <Clock size={12} />}
                                        {proxy.status}
                                    </span>
                                    <span className={styles.time}>
                                        {new Date(proxy.lastChecked).toLocaleString()}
                                    </span>
                                </div>

                                <div className={styles.qrWrap}>
                                    <QRCodeSVG value={proxy.url} size={140} includeMargin={true} />
                                </div>

                                <div className={styles.proxyMeta}>
                                    <span className={`${styles.proxyMetaLabel} ${styles.serverName}`}>{getServerHost(proxy.url)}</span>
                                    <span className={styles.proxyMetaValue}>{proxy.url}</span>
                                </div>

                                <div className={styles.actions}>
                                    <button
                                        onClick={() => copyToClipboard(proxy.url)}
                                        className={styles.actionSecondary}
                                    >
                                        <Copy size={16} /> Copy Code
                                    </button>
                                    <a
                                        href={proxy.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.actionPrimary}
                                    >
                                        <ExternalLink size={16} /> Connect
                                    </a>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {!loading && proxies.length === 0 && (
                    <div className={styles.empty}>
                        <p>No proxies found. Click "Update Status" to fetch.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
