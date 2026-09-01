let sidebar = document.getElementById('post-sidebar');
let sidebarLevels = sidebar.getAttribute('data-sidebar-levels');
let sidebarInner = sidebar.querySelector('.sidebar-inner');

let headings = document.querySelector('div.post-content').querySelectorAll(sidebarLevels);

for (let i = 0; i < headings.length; i++) {
    let heading = headings[i];
    let fragment = heading.id;
    sidebarInner.insertAdjacentHTML(
        'beforeend',
        `<a class="sidebar-link level-${heading.tagName.toLowerCase()}" href="#${fragment}">${heading.textContent}</a>`
    );
}

if (headings.length === 0) {
    sidebar.classList.add('empty');
}

let postContent = document.querySelector('div.post-content');
let hrefLevels = postContent.getAttribute('data-href-levels');

hrefLevels.split(',').forEach(hrefLevel => {
  for(let h of document.querySelectorAll(`div.post-content > ${hrefLevel}[id]`)) {
    h.innerHTML += ` <a href="#${h.id}" aria-hidden="true">#</a>`;
  }
});