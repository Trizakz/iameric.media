// the menu bar (nav.css): marks it .scrolled as soon as whatever scrolls the page (the window, or a sub page's own
// panel) has left the top
const nav = document.querySelector('.site-nav');
if (nav) {
  addEventListener('scroll', e => {
    const el = e.target === document ? document.scrollingElement : e.target;
    nav.classList.toggle('scrolled', el.scrollTop > 4);
  }, { capture: true, passive: true });
}

