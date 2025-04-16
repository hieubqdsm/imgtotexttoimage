// Xử lý chuyển đổi ảnh/video thành ký tự và hiệu ứng CRT
const crtContainer = document.getElementById('crt-container');
const fileInput = document.getElementById('file-input');

function imageToAscii(img, width = 120) {
    const chars = '@#W$9876543210?!abc;:+=-,._ ';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const aspectRatio = img.height / img.width;
    canvas.width = width;
    canvas.height = Math.round(width * aspectRatio * 0.5);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let ascii = [];
    for (let y = 0; y < canvas.height; y++) {
        let row = [];
        for (let x = 0; x < canvas.width; x++) {
            const offset = (y * canvas.width + x) * 4;
            const r = imgData.data[offset];
            const g = imgData.data[offset + 1];
            const b = imgData.data[offset + 2];
            const avg = (r + g + b) / 3;
            const charIdx = Math.floor((avg / 255) * (chars.length - 1));
            row.push({
                char: chars[charIdx],
                color: `rgb(${r},${g},${b})`
            });
        }
        ascii.push(row);
    }
    return ascii;
}

function renderAscii(ascii) {
    let html = '<pre style="margin:0;">';
    for (let y = 0; y < ascii.length; y++) {
        for (let x = 0; x < ascii[y].length; x++) {
            const {char, color} = ascii[y][x];
            html += `<span style=\"color:${color}\">${char}</span>`;
        }
        html += '\n';
    }
    html += '</pre>';
    crtContainer.innerHTML = html;
}

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
            const ascii = imageToAscii(img);
            renderAscii(ascii);
        };
        img.src = URL.createObjectURL(file);
    } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.autoplay = true;
        video.muted = true;
        video.play();
        video.addEventListener('play', function () {
            function step() {
                if (video.paused || video.ended) return;
                const canvas = document.createElement('canvas');
                canvas.width = 120;
                canvas.height = Math.round(120 * (video.videoHeight / video.videoWidth) * 0.5);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const img = new Image();
                img.onload = () => {
                    const ascii = imageToAscii(img, 120);
                    renderAscii(ascii);
                };
                img.src = canvas.toDataURL();
                requestAnimationFrame(step);
            }
            step();
        });
    }
});