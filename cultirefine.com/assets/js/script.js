document.querySelectorAll('a[href^="#"]').forEach(function (link) {
  link.addEventListener('click', function (event) {
    event.preventDefault();
    var speed = 1000;
    var headerbar = 0;
    var href = this.getAttribute("href");
    var target = href === "#" || href === "" ? document.documentElement : document.querySelector(href);
    if (target) {
      var position = target.offsetTop - headerbar;
      window.scrollTo({
        top: position,
        behavior: "smooth"
      });
    }
  });
});
function loadingFade(){
  const spinner = document.getElementById('loading');
  spinner.classList.add('fade');
}
function loadingOut(){
  const spinner = document.getElementById('loading');
  spinner.classList.add('out');
}
function loadingBlack(){
  const spinner = document.getElementById('loading--black');
  spinner.classList.add('active');
}
window.onload = function () {
  const spinner = document.getElementById('loading--logo-svg');
  spinner.classList.add('active');
  setTimeout(loadingBlack, 2800);
  setTimeout(loadingFade, 5400);
  setTimeout(loadingOut, 6600);
}
const concept = document.querySelector('.sec--concept'),
      gallery = document.querySelector('.sec--gallery'),
      reservation = document.querySelector('.sec--reservation'),
      block = document.querySelector('.sec--block'),
      conceptOpenButton = document.querySelector('.concept--open'),
      galleryOpenButton = document.querySelector('.gallery--open'),
      reservationOpenButton = document.querySelector('.reservation--open'),
      conceptCloseButton = document.querySelector('.block--close-concept'),
      galleryCloseButton = document.querySelector('.block--close-gallery'),
      reservationCloseButton = document.querySelector('.block--close-reservation');

function conceptOpen() {
  concept.classList.add('active');
}
conceptOpenButton.addEventListener('click', conceptOpen);

function galleryOpen() {
  gallery.classList.add('active');
}
galleryOpenButton.addEventListener('click', galleryOpen);

function reservationOpen() {
  reservation.classList.add('active');
}
reservationOpenButton.addEventListener('click', reservationOpen);

function conceptClose() {
  concept.classList.remove('active');
}
conceptCloseButton.addEventListener('click', conceptClose);

function galleryClose() {
  gallery.classList.remove('active');
}
galleryCloseButton.addEventListener('click', galleryClose);

function reservationClose() {
  reservation.classList.remove('active');
}
reservationCloseButton.addEventListener('click', reservationClose);
