import { useState, useEffect } from 'react';
import Head from 'next/head';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, RefreshCw, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import styles from '../styles/Home.module.css';

interface Proxy {
    url: string;
    status: 'available' | 'unavailable' | 'pending';
    lastChecked: string;
}

export default function ProxyBlog() {
    const [proxies, setProxies] = useState<Proxy[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const availableCount = proxies.filter((proxy) => proxy.status === 'available').length;
    const unavailableCount = proxies.filter((proxy) => proxy.status === 'unavailable').length;

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

    const handleManualUpdate = async () => {
        setUpdating(true);
        try {
            // Сначала подтягиваем новые, если их нет
            if (proxies.length === 0) await fetch('/api/cron-fetch');
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

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Link copied to clipboard!");
    };

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
                <title>MTProto Proxy List</title>
                <meta name="description" content="Fresh Telegram MTProto Proxies" />
            </Head>

            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div>
                        <p className={styles.eyebrow}>Telegram Access</p>
                        <h1 className={styles.title}>MTProto Proxy Hub</h1>
                        <p className={styles.subtitle}>Auto-updated weekly with on-demand server checks.</p>
                    </div>
                    <button
                        onClick={handleManualUpdate}
                        disabled={updating}
                        className={styles.updateButton}
                    >
                        <RefreshCw className={updating ? styles.spinning : ''} size={18} />
                        {updating ? 'Checking...' : 'Update Status'}
                    </button>
                </div>
            </header>

            <main className={styles.main}>
                <section className={styles.summaryBar}>
                    <div className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>Total proxies</span>
                        <span className={styles.summaryValue}>{proxies.length}</span>
                    </div>
                    <div className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>Available now</span>
                        <span className={styles.summaryValue}>{availableCount}</span>
                    </div>
                    <div className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>Unavailable</span>
                        <span className={styles.summaryValue}>{unavailableCount}</span>
                    </div>
                </section>

                {loading && proxies.length === 0 ? (
                    <div className={styles.loading}>
                        <div>Loading proxies...</div>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {proxies.map((proxy, idx) => (
                            <article key={idx} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <span className={`${styles.status} ${proxy.status === 'available' ? styles.available :
                                            proxy.status === 'unavailable' ? styles.unavailable : styles.pending
                                        }`}>
                                        {proxy.status === 'available' ? <CheckCircle size={12} /> : <XCircle size={12} />}
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
                                    <span className={styles.proxyMetaLabel}>Proxy URL</span>
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
