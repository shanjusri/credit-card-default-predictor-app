const CHART_JS_URL = 'https://cdn.jsdelivr.net/npm/chart.js';
let chartLoaderPromise = null;
let navInFlight = false;

function configureChartDefaults() {
    if (window.Chart) {
        Chart.defaults.color = '#8b99af';
        Chart.defaults.font.family = "'Inter', sans-serif";
    }
}

function ensureChartJsLoaded() {
    if (window.Chart) {
        configureChartDefaults();
        return Promise.resolve();
    }

    if (chartLoaderPromise) {
        return chartLoaderPromise;
    }

    chartLoaderPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = CHART_JS_URL;
        script.onload = () => {
            configureChartDefaults();
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Chart.js'));
        document.head.appendChild(script);
    });

    return chartLoaderPromise;
}

window.runWhenChartsReady = function (callback) {
    ensureChartJsLoaded()
        .then(callback)
        .catch(() => {
            // No-op fallback so the page remains usable without chart rendering.
        });
};

function setupDropArea(dropArea) {
    if (dropArea.dataset.initialized === 'true') {
        return;
    }

    const fileInput = dropArea.querySelector('.file-input');
    const fileMsg = dropArea.querySelector('.file-msg');
    if (!fileInput || !fileMsg) {
        return;
    }

    dropArea.dataset.initialized = 'true';

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('is-active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('is-active');
        }, false);
    });

    dropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        fileInput.files = files;
        updateFileName();
    }, false);

    fileInput.addEventListener('change', updateFileName);

    function updateFileName() {
        if (fileInput.files.length > 0) {
            fileMsg.textContent = fileInput.files[0].name;
            fileMsg.style.color = '#fff';
            return;
        }

        fileMsg.textContent = 'Drag & Drop CSV or Click';
        fileMsg.style.color = 'var(--text-muted)';
    }
}

function initFileUploadUI(scope = document) {
    scope.querySelectorAll('.file-drop-area').forEach(setupDropArea);
}

function initPredictionForm(scope = document) {
    const form = scope.querySelector('#predictionForm');
    if (!form || form.dataset.initialized === 'true') {
        return;
    }

    form.dataset.initialized = 'true';
    form.addEventListener('submit', function () {
        const btn = form.querySelector('button');
        if (!btn) {
            return;
        }

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Predicting...';
        btn.style.opacity = '0.7';
        btn.style.cursor = 'wait';
    });
}

function runInlineScripts(doc) {
    const inlineScripts = doc.querySelectorAll('script:not([src])');
    inlineScripts.forEach(script => {
        const scriptEl = document.createElement('script');
        scriptEl.text = script.textContent;
        document.body.appendChild(scriptEl);
        document.body.removeChild(scriptEl);
    });
}

function syncActiveNav(pathname) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const targetPath = new URL(link.href, window.location.origin).pathname;
        link.classList.toggle('active', targetPath === pathname);
    });
}

function needsCharts(pathname, doc) {
    if (pathname === '/analytics') {
        return true;
    }

    return Boolean(
        doc.querySelector('#billChart') ||
        doc.querySelector('#batchChart') ||
        doc.querySelector('#riskDistributionChart')
    );
}

async function navigateWithoutReload(url, pushState = true) {
    if (navInFlight) {
        return;
    }

    const content = document.querySelector('#content');
    if (!content) {
        window.location.href = url;
        return;
    }

    navInFlight = true;
    content.classList.remove('fade-in');
    content.classList.add('fade-out');

    try {
        const response = await fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            throw new Error('Navigation request failed');
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const nextContent = doc.querySelector('#content');

        if (!nextContent) {
            window.location.href = url;
            return;
        }

        const pathname = new URL(url, window.location.origin).pathname;
        if (needsCharts(pathname, doc)) {
            await ensureChartJsLoaded();
        }

        content.innerHTML = nextContent.innerHTML;
        document.title = doc.title || document.title;
        syncActiveNav(pathname);

        if (pushState) {
            window.history.pushState({}, '', pathname);
        }

        initFileUploadUI(content);
        initPredictionForm(content);
        runInlineScripts(doc);

        content.classList.remove('fade-out');
        content.classList.add('fade-in');
    } catch (error) {
        window.location.href = url;
    } finally {
        navInFlight = false;
    }
}

function initSpaNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                return;
            }

            event.preventDefault();
            navigateWithoutReload(link.href, true);
        });
    });

    window.addEventListener('popstate', () => {
        navigateWithoutReload(window.location.href, false);
    });
}

function initSingleChart() {
    const ctx = document.getElementById('billChart');
    if (!ctx || !window.Chart || !window.clientData) return;

    const data = window.clientData;
    const billAmts = [data.BILL_AMT6, data.BILL_AMT5, data.BILL_AMT4, data.BILL_AMT3, data.BILL_AMT2, data.BILL_AMT1];
    const payAmts = [data.PAY_AMT6, data.PAY_AMT5, data.PAY_AMT4, data.PAY_AMT3, data.PAY_AMT2, data.PAY_AMT1];
    const labels = ["Month -5", "Month -4", "Month -3", "Month -2", "Month -1", "Last Month"];

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Bill Amount ($)',
                    data: billAmts,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Paid Amount ($)',
                    data: payAmts,
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'User Billing & Payment History',
                    color: '#f2f5f9'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#2a3143'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function initBatchChart() {
    const ctx = document.getElementById('batchChart');
    if (!ctx || !window.Chart || !window.batchData) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['High Risk', 'Low Risk'],
            datasets: [{
                data: [window.batchData.high, window.batchData.low],
                backgroundColor: [
                    '#ef4444',
                    '#10b981'
                ],
                borderColor: '#151b2b',
                borderWidth: 4,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#f2f5f9' }
                }
            },
            cutout: '75%'
        }
    });
}

window.initSingleChart = initSingleChart;
window.initBatchChart = initBatchChart;

document.addEventListener('DOMContentLoaded', () => {
    initFileUploadUI(document);
    initPredictionForm(document);
    initSpaNavigation();
});
