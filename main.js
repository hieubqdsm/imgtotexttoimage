// Xử lý chuyển đổi ảnh/video thành ký tự và hiệu ứng CRT
const crtContainer = document.getElementById('crt-container');
const fileInput = document.getElementById('file-input');

let currentVideo = null;
let animationFrameId = null;

function imageToAscii(img, width = 120, frameOffset = 0) {
    const chars = '@#W$9876543210?!abc;:+=-,._ ';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const aspectRatio = img.height / img.width;
    canvas.width = width;
    canvas.height = Math.round(width * aspectRatio * 0.5);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let ascii = [];
    let charCounter = 0; // Bộ đếm để lặp qua các ký tự
    for (let y = 0; y < canvas.height; y++) {
        let row = [];
        for (let x = 0; x < canvas.width; x++) {
            const offset = (y * canvas.width + x) * 4;
            const r = imgData.data[offset];
            const g = imgData.data[offset + 1];
            const b = imgData.data[offset + 2];
            const brightness = (r + g + b) / 3; // Tính độ sáng trung bình (0-255)
            const brightnessIndex = Math.floor((brightness / 255) * (chars.length - 1)); // Map độ sáng vào index của chars
            // Kết hợp brightnessIndex và frameOffset để chọn ký tự, đảm bảo thay đổi theo thời gian
            const charIndex = (brightnessIndex + frameOffset) % chars.length;
            const char = chars[charIndex];
            row.push({
                char: char,
                color: `rgb(${r},${g},${b})`
            });
            // Không cần charCounter nữa vì index giờ dựa trên độ sáng và frameOffset
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
    // Dừng xử lý video hiện tại nếu có
    if (currentVideo) {
        currentVideo.pause();
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        // Không cần xóa video khỏi DOM vì nó không được thêm vào
        currentVideo = null;
    }
    crtContainer.innerHTML = ''; // Xóa nội dung cũ
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
        video.loop = true; // Thêm dòng này để video tự động lặp lại
        video.play();
        video.addEventListener('play', function () {
            currentVideo = video; // Lưu tham chiếu video hiện tại
            let frameCounter = 0; // Khởi tạo bộ đếm khung hình
            function step() {
                if (!currentVideo || currentVideo.paused || currentVideo.ended) {
                    // Dọn dẹp khi video kết thúc hoặc bị dừng
                    if (currentVideo === video) { // Chỉ dọn dẹp nếu đây là video cuối cùng được xử lý
                       currentVideo = null;
                       animationFrameId = null;
                    }
                    return;
                }
                const canvas = document.createElement('canvas');
                const containerWidth = crtContainer.clientWidth;
                const containerHeight = crtContainer.clientHeight;

                // Kiểm tra video dimensions hợp lệ
                if (!video.videoWidth || !video.videoHeight || !containerWidth || !containerHeight) {
                    console.warn("Kích thước video hoặc container không hợp lệ, chờ frame tiếp theo.");
                    if (currentVideo === video) animationFrameId = requestAnimationFrame(step); // Thử lại frame sau nếu video còn active
                    return;
                }

                const videoAspectRatio = video.videoWidth / video.videoHeight;

                // Ước tính kích thước ký tự từ phần tử pre (nếu có) hoặc dùng giá trị mặc định
                let charWidthApprox = 6; // Mặc định
                let charHeightApprox = 10; // Mặc định
                const preElement = crtContainer.querySelector('pre');
                if (preElement) {
                    const computedStyle = window.getComputedStyle(preElement);
                    const fontSize = parseFloat(computedStyle.fontSize);
                    if (fontSize) {
                         // Ước tính dựa trên font monospace, tỷ lệ có thể thay đổi
                        charWidthApprox = fontSize * 0.6;
                        charHeightApprox = parseFloat(computedStyle.lineHeight) || fontSize * 1.2;
                    }
                }

                if (charWidthApprox <= 0 || charHeightApprox <= 0) {
                    console.error("Không thể xác định kích thước ký tự hợp lệ.");
                    if (currentVideo === video) animationFrameId = requestAnimationFrame(step); // Thử lại frame sau nếu video còn active
                    return;
                }

                // Tính toán số cột và hàng tối đa có thể vừa trong container
                const maxCols = Math.floor(containerWidth / charWidthApprox);
                const maxRows = Math.floor(containerHeight / charHeightApprox);

                if (maxCols <= 0 || maxRows <= 0) {
                    console.warn("Kích thước container quá nhỏ.");
                     if (currentVideo === video) animationFrameId = requestAnimationFrame(step); // Thử lại frame sau nếu video còn active
                    return;
                }

                // Tính toán chiều rộng ASCII tối ưu dựa trên chiều rộng container
                let asciiWidth = maxCols;
                // Chiều cao tương ứng, nhân 0.5 để bù cho tỷ lệ ký tự (cao gấp đôi rộng)
                // Sử dụng tỷ lệ charHeight/charWidth thay vì cố định 0.5 nếu muốn chính xác hơn
                let asciiHeight = Math.round(asciiWidth / videoAspectRatio * (charWidthApprox / charHeightApprox));

                // Nếu chiều cao tính toán vượt quá giới hạn, tính lại chiều rộng dựa trên chiều cao tối đa
                if (asciiHeight > maxRows || asciiHeight <= 0) { // Thêm kiểm tra <= 0
                    asciiHeight = maxRows;
                    // Chiều rộng tương ứng, dùng tỷ lệ ngược lại
                    asciiWidth = Math.round(asciiHeight * videoAspectRatio * (charHeightApprox / charWidthApprox));
                    // Đảm bảo không vượt quá maxCols sau khi tính lại
                    asciiWidth = Math.min(asciiWidth, maxCols);
                }
                 // Đảm bảo chiều rộng không vượt quá maxCols sau lần tính đầu tiên (trường hợp không vào if trên)
                asciiWidth = Math.min(asciiWidth, maxCols);


                // Đảm bảo kích thước tối thiểu và không âm/zero
                asciiWidth = Math.max(10, asciiWidth);
                asciiHeight = Math.max(5, asciiHeight);

                // Kích thước canvas để vẽ video lên trước khi lấy pixel data
                // Chiều rộng canvas bằng số cột ASCII mong muốn
                canvas.width = asciiWidth;
                 // Chiều cao canvas cần tỷ lệ với video để lấy đúng pixel, KHÔNG nhân 0.5 ở đây
                 // vì imageToAscii sẽ xử lý tỷ lệ pixel/ký tự dựa trên kích thước ảnh đầu vào
                canvas.height = Math.round(asciiWidth / videoAspectRatio);
                // Đảm bảo chiều cao canvas không là zero/âm
                if (canvas.height <= 0) {
                    console.warn("Chiều cao canvas tính toán không hợp lệ, dùng giá trị tối thiểu.");
                    // Tính lại chiều cao dựa trên chiều rộng tối thiểu và tỷ lệ
                    canvas.height = Math.max(1, Math.round(10 / videoAspectRatio)); // Tối thiểu 1px
                }

                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const img = new Image();
                img.onload = () => {
                    // Chỉ render nếu video này vẫn là video hiện tại
                    if (currentVideo === video) {
                       const ascii = imageToAscii(img, asciiWidth, frameCounter); // Truyền frameCounter
                       renderAscii(ascii);
                       frameCounter++; // Tăng bộ đếm khung hình cho lần gọi tiếp theo
                    }
                };
                img.src = canvas.toDataURL();
                animationFrameId = requestAnimationFrame(step);
            }
            // Đảm bảo video đã sẵn sàng trước khi bắt đầu vẽ
            if (video.readyState >= 2) { // HAVE_CURRENT_DATA
                 step();
            } else {
                 video.addEventListener('loadeddata', step, { once: true });
            }
        });
        // Xử lý lỗi tải video
        video.addEventListener('error', (err) => {
            console.error("Lỗi tải video:", err);
            crtContainer.innerHTML = '<pre style="color:red;">Lỗi khi tải video.</pre>';
            currentVideo = null; // Dọn dẹp
            animationFrameId = null;
        });
    }
        });