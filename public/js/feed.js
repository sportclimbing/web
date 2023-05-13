function get_image_url(html, el) {
    let imageUrl = html(el, "description").match(/src="([^"]+)"/)[1];

    return `img/news/${basename(imageUrl)}`;
}

(() => {
    let RSS_URL = `feed/rss.xml`;
    let container = document.getElementById("container");
    let template = document.getElementById("news-item-template");

    function html(el, selector) {
        let e = el.querySelector(selector);
        return e ? e.innerHTML : null;
    }

    const maxItems = 12;
    let count = 0;

    fetch(RSS_URL)
        .then(response => response.text())
        .then(str => new window.DOMParser().parseFromString(str, "text/xml"))
        .then((data) => {
            for (const el of data.querySelectorAll("item")) {
                try {
                    if (count++ === maxItems) {
                        break;
                    }

                    let clone = template.content.cloneNode(true);
                    clone.getElementById('ifsc-title').innerHTML = html(el, "title");
                    clone.getElementById('ifsc-title').href = html(el, "guid");
                    clone.getElementById('ifsc-image').src = get_image_url(html, el);
                    clone.getElementById('ifsc-date').innerText += dayjs(html(el, "pubDate")).fromNow();

                    container.appendChild(clone);
                } catch (e) {
                }
            }
        });
})();
