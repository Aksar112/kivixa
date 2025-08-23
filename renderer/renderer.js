import showdown from 'showdown';

document.addEventListener('DOMContentLoaded', () => {
    // -- Tab Switching Logic --
    const tabs = document.getElementById('tabs');
    const tabContents = {
        notebook: document.getElementById('notebook-view'),
        help: document.getElementById('help-view'),
    };
    const tabLinks = document.querySelectorAll('.tab-link');
    let helpContentLoaded = false;

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tab = link.dataset.tab;

            tabLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            Object.values(tabContents).forEach(content => content.classList.remove('active'));
            tabContents[tab.split('-')[0]].classList.add('active');

            if (tab === 'help-view' && !helpContentLoaded) {
                loadHelpContent();
            }
        });
    });

    async function loadHelpContent() {
        const markdown = await window.electron.getDocumentation();
        const converter = new showdown.Converter();
        const html = converter.makeHtml(markdown);
        tabContents.help.innerHTML = html;
        helpContentLoaded = true;
    }

    // ... (The rest of your existing renderer.js code for canvas, tools, etc.)

    // -- Init --
    function init() {
        // ... (your existing init logic)
    }

    init();
});
