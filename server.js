// File: server.js (Phiên bản Hoàn Chỉnh sử dụng lowdb/JSON - Đã sửa lỗi URL Localhost)
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs'); 
const { nanoid } = require('nanoid'); 
// LOWDB Imports
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10; 
const DB_FILE = 'db.json'; // Tên file Database JSON

// --- Hàm quan trọng để lấy Base URL động ---
/**
 * Lấy Base URL (giao thức + host) từ request hiện tại.
 * Đảm bảo đường dẫn đúng khi chạy trên Render (HTTPS).
 */
function getBaseUrl(req) {
    // Lấy host (ví dụ: noteqvn-sever.onrender.com)
    const host = req.headers.host; 
    
    // Lấy giao thức: ưu tiên header X-Forwarded-Proto (thường là 'https' trên Render)
    const protocol = req.get('X-Forwarded-Proto') || req.protocol; 

    return `${protocol}://${host}`;
}
// --- Hết Hàm quan trọng ---

// --- Cấu hình LowDB (JS-only) ---
let db;
try {
    const adapter = new JSONFile(DB_FILE);
    db = new Low(adapter, { users: [], notes: [] });
    
    // Tải dữ liệu từ file
    db.read();
    
    // Khởi tạo dữ liệu mặc định nếu file trống
    if (!db.data.users || !db.data.notes) {
        db.data = { users: [], notes: [] };
        db.write();
    }
    console.log(`[DB] Đã kết nối đến Database LowDB (JSON): ${DB_FILE}`);
    app.locals.db = db;

} catch (err) {
    console.error('❌ Lỗi FATAL khi khởi tạo LowDB:', err.message);
    process.exit(1);
}

// --- Cấu hình Middleware ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Cấu hình Session 
app.use(session({
    secret: 'daylakhobimathoacsession', 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production' } // Thêm secure: true cho production
}));
app.use(flash());

// Middleware để kiểm tra đã đăng nhập chưa
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        req.flash('error', 'Bạn cần đăng nhập để truy cập trang này.');
        res.redirect('/login');
    }
}

// Middleware để thêm thông tin người dùng vào res.locals
app.use(async (req, res, next) => {
    res.locals.isLoggedIn = !!req.session.userId;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.username = 'User'; 

    if (req.session.userId) {
        const user = app.locals.db.data.users.find(u => u.id === req.session.userId);
        if (user) {
            res.locals.username = user.username;
        }
    }
    next();
});

// CSS TỔNG THỂ (Giữ nguyên)
const style = `
    body {
        font-family: Arial, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 50px;
        background-color: #f4f4f9;
        color: #333;
    }
    .container {
        width: 90%;
        max-width: 600px;
        padding: 20px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        text-align: center;
    }
    .header {
        width: 100%;
        max-width: 600px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 20px;
        margin-bottom: 20px;
    }
    .menu-button {
        background: none;
        border: none;
        font-size: 30px;
        cursor: pointer;
        color: #007bff;
        text-decoration: none;
    }
    input[type="text"], input[type="password"], textarea {
        width: calc(100% - 22px);
        padding: 10px;
        margin: 8px 0;
        border: 1px solid #ccc;
        border-radius: 5px;
        box-sizing: border-box;
    }
    .button-primary {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 10px 20px;
        font-size: 16px;
        margin-top: 10px;
        cursor: pointer;
        border-radius: 5px;
        transition: background-color 0.3s;
    }
    .button-primary:hover {
        background-color: #0056b3;
    }
    .error-message {
        color: red;
        margin-bottom: 15px;
        border: 1px solid red;
        padding: 10px;
        background-color: #ffe0e0;
        border-radius: 5px;
    }
    .success-message {
        color: green;
        margin-bottom: 15px;
        border: 1px solid green;
        padding: 10px;
        background-color: #e0ffe0;
        border-radius: 5px;
    }
    .note-box {
        text-align: left;
        border: 2px solid #007bff; 
        padding: 15px;
        background-color: #eaf6ff;
        border-radius: 8px;
        margin-bottom: 20px;
        white-space: pre-wrap;
    }
    .note-item {
        border-bottom: 1px solid #eee;
        padding: 10px 0;
        text-align: left;
    }
    .note-item:last-child {
        border-bottom: none;
    }
    .link-box {
        background-color: #f0f0f0;
        padding: 10px;
        border-radius: 5px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
    }
    .copy-button {
        background-color: #28a745;
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 5px;
        cursor: pointer;
        margin-left: 10px;
        transition: background-color 0.3s;
    }
    .copy-button:hover {
        background-color: #1e7e34;
    }
`;

/** Hàm render HTML chung **/
function renderHTML(title, bodyContent, req, username) {
    let headerLinks = `<a href="/register" class="menu-button" style="font-size: 18px;">Đăng Ký</a> | <a href="/login" class="menu-button" style="font-size: 18px;">Đăng Nhập</a>`;
    let menuButton = '';
    
    if (req.session.userId) {
        headerLinks = `<span style="font-size: 16px;">Xin chào, <b>${username}</b>!</span> | <a href="/logout" class="menu-button" style="font-size: 18px; color: red;">Đăng Xuất</a>`;
        menuButton = `<a href="/mynotes" class="menu-button">|||</a>`;
    }

    const flashMessages = (req.flash('error').length > 0) 
        ? `<p class="error-message">${req.flash('error').join('<br>')}</p>` 
        : (req.flash('success').length > 0 
            ? `<p class="success-message">${req.flash('success').join('<br>')}</p>` : '');

    return `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <title>${title}</title>
            <style>${style}</style>
        </head>
        <body>
            <div class="header">
                <a href="/" class="menu-button" style="font-size: 24px;">📝 NoteQVn</a>
                ${menuButton}
                <div style="text-align: right;">${headerLinks}</div>
            </div>
            <div class="container">
                ${flashMessages}
                ${bodyContent}
            </div>
        </body>
        </html>
    `;
}

// --- TRANG CHỦ (GET /) ---
app.get('/', async (req, res) => {
    const BASE_URL = getBaseUrl(req); // <--- LẤY BASE URL ĐỘNG TẠI ĐÂY

    const db = app.locals.db;
    let noteContent = ''; // Nội dung ghi chú đã được lưu (nếu có)
    let noteLinkBox = '';

    // Kiểm tra và hiển thị ghi chú đã lưu (nếu có)
    if (req.session.lastNoteId) {
        // Tìm ghi chú trong DB
        const lastNote = db.data.notes.find(n => n.id === req.session.lastNoteId);
        
        if (lastNote) {
            noteContent = lastNote.content;

            // TẠO URL CHÍNH XÁC
            const fullNoteUrl = `${BASE_URL}/${lastNote.id}`; // <--- SỬ DỤNG BASE_URL ĐỘNG

            noteLinkBox = `
                <h2>Ghi Chú Đã Lưu:</h2>
                <div class="note-box">${noteContent}</div>
                <h3>Đường dẫn chia sẻ:</h3>
                <div class="link-box">
                    <span id="note-link-url">${fullNoteUrl}</span>
                    <button class="copy-button" onclick="copyToClipboard('${fullNoteUrl}')">Sao Chép</button>
                </div>
            `;
            // Xóa ID sau khi hiển thị 
            delete req.session.lastNoteId; 
        }
    }

    const bodyContent = `
        <h1>✍️ Tạo Ghi Chú Mới</h1>
        <form method="POST" action="/">
            <textarea name="note" rows="8" placeholder="Viết ghi chú của bạn vào đây..." required></textarea>
            <button type="submit" class="button-primary">💾 Lưu Ghi Chú</button>
        </form>
        ${noteLinkBox}
        <script>
            function copyToClipboard(text) {
                // Sử dụng API Clipboard hiện đại
                navigator.clipboard.writeText(text).then(function() {
                    alert('Đã sao chép đường dẫn: ' + text);
                }, function(err) {
                    // Fallback cho các trình duyệt cũ hơn
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    alert('Đã sao chép đường dẫn: ' + text);
                });
            }
        </script>
    `;
    res.send(renderHTML('Trang Chủ', bodyContent, req, res.locals.username));
});

// --- XỬ LÝ LƯU GHI CHÚ (POST /) ---
app.post('/', isAuthenticated, async (req, res) => {
    const { note } = req.body;
    const db = app.locals.db;

    if (!note || note.trim() === "") {
        req.flash('error', 'Nội dung ghi chú không được để trống.');
        return res.redirect('/');
    }

    try {
        const userId = req.session.userId;
        const noteId = nanoid(8); 
        
        db.data.notes.push({ 
            id: noteId, 
            userId: userId, 
            content: note,
            createdAt: new Date().toISOString()
        });
        await db.write();

        // Lưu ID vào session để route GET / có thể hiển thị link đúng
        req.session.lastNoteId = noteId; 
        
        req.flash('success', 'Ghi chú đã được lưu thành công!');
        res.redirect('/');
        
    } catch (e) {
        console.error("Lỗi khi lưu ghi chú:", e);
        req.flash('error', 'Lỗi hệ thống khi lưu ghi chú.');
        res.redirect('/');
    }
});

// --- TRANG XEM GHI CHÚ RIÊNG (GET /:id) ---
app.get('/:id', async (req, res) => {
    const noteId = req.params.id;
    const db = app.locals.db;
    
    // Tìm ghi chú
    const note = db.data.notes.find(n => n.id === noteId);

    if (!note) {
        req.flash('error', 'Ghi chú không tồn tại.');
        return res.redirect('/');
    }
    
    // Lấy link hiện tại để chia sẻ
    const BASE_URL = getBaseUrl(req);
    const fullNoteUrl = `${BASE_URL}/${noteId}`;

    const bodyContent = `
        <h1>Ghi Chú ${noteId}</h1>
        <div class="note-box">${note.content}</div>
        <h3>Đường dẫn chia sẻ:</h3>
        <div class="link-box">
            <span id="note-link-url">${fullNoteUrl}</span>
            <button class="copy-button" onclick="copyToClipboard('${fullNoteUrl}')">Sao Chép</button>
        </div>
        <p><a href="/" style="font-size: 16px; margin-top: 15px; display: block;">Về trang tạo ghi chú</a></p>
        <script>
            function copyToClipboard(text) {
                navigator.clipboard.writeText(text).then(function() {
                    alert('Đã sao chép đường dẫn: ' + text);
                }, function(err) {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    alert('Đã sao chép đường dẫn: ' + text);
                });
            }
        </script>
    `;
    res.send(renderHTML(`Ghi Chú ${noteId}`, bodyContent, req, res.locals.username));
});

// --- TRANG DANH SÁCH GHI CHÚ CỦA TÔI (GET /mynotes) ---
app.get('/mynotes', isAuthenticated, async (req, res) => {
    const db = app.locals.db;
    const userId = req.session.userId;
    
    // Lấy tất cả ghi chú của người dùng này, sắp xếp theo thời gian mới nhất
    const userNotes = db.data.notes
        .filter(n => n.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let notesList = userNotes.map(n => {
        // Lấy 50 ký tự đầu làm tiêu đề xem trước
        const preview = n.content.substring(0, 50) + (n.content.length > 50 ? '...' : '');
        const date = new Date(n.createdAt).toLocaleString('vi-VN');
        return `
            <div class="note-item">
                <p><strong>Ngày tạo:</strong> ${date}</p>
                <p><b>Xem trước:</b> ${preview}</p>
                <p><a href="/${n.id}">Xem Chi Tiết</a> | 
                   <a href="/delete/${n.id}" onclick="return confirm('Bạn có chắc chắn muốn xóa ghi chú này?');" style="color: red;">Xóa</a></p>
            </div>
        `;
    }).join('');

    if (userNotes.length === 0) {
        notesList = '<p>Bạn chưa có ghi chú nào. Hãy tạo ghi chú mới!</p>';
    }

    const bodyContent = `
        <h1>📝 Ghi Chú Của Tôi</h1>
        ${notesList}
    `;
    res.send(renderHTML('Ghi Chú Của Tôi', bodyContent, req, res.locals.username));
});

// --- XỬ LÝ XÓA GHI CHÚ (GET /delete/:id) ---
app.get('/delete/:id', isAuthenticated, async (req, res) => {
    const noteId = req.params.id;
    const db = app.locals.db;
    const userId = req.session.userId;

    // Tìm index của ghi chú
    const noteIndex = db.data.notes.findIndex(n => n.id === noteId && n.userId === userId);

    if (noteIndex === -1) {
        req.flash('error', 'Ghi chú không tồn tại hoặc bạn không có quyền xóa.');
        return res.redirect('/mynotes');
    }

    // Xóa ghi chú
    db.data.notes.splice(noteIndex, 1);
    await db.write();

    req.flash('success', 'Ghi chú đã được xóa thành công.');
    res.redirect('/mynotes');
});


// --- TRANG ĐĂNG KÝ (GET /register) ---
app.get('/register', (req, res) => {
    const bodyContent = `
        <h1>Đăng Ký Tài Khoản</h1>
        <form method="POST" action="/register">
            <label for="username">Tên người dùng:</label>
            <input type="text" id="username" name="username" required><br>
            
            <label for="password">Mật khẩu:</label>
            <input type="password" id="password" name="password" required><br>
            
            <label for="confirm_password">Xác nhận lại mật khẩu:</label>
            <input type="password" id="confirm_password" name="confirm_password" required><br>
            
            <button type="submit" class="button-primary">Tạo Tài Khoản</button>
        </form>
    `;
    res.send(renderHTML('Đăng Ký', bodyContent, req, res.locals.username));
});

// --- XỬ LÝ ĐĂNG KÝ (POST /register) ---
app.post('/register', async (req, res) => {
    const { username, password, confirm_password } = req.body;
    const db = app.locals.db;

    if (password.length < 4) {
        req.flash('error', 'Mật khẩu phải có ít nhất 4 ký tự.');
        return res.redirect('/register');
    }
    if (password !== confirm_password) {
        req.flash('error', 'Mật khẩu xác nhận không khớp.');
        return res.redirect('/register');
    }

    // 1. Kiểm tra username tồn tại
    const userExists = db.data.users.find(u => u.username === username);

    if (userExists) {
        req.flash('error', 'Tên người dùng đã tồn tại. Vui lòng chọn tên khác.');
        return res.redirect('/register');
    }

    // 2. Mã hóa và lưu
    try {
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const userId = nanoid(10);
        
        db.data.users.push({ id: userId, username, passwordHash });
        await db.write(); // Lưu thay đổi vào file JSON
        
        req.flash('success', 'Đăng ký thành công! Vui lòng đăng nhập.');
        console.log(`[USER] Đăng ký mới: ${username} (ID: ${userId})`);
        res.redirect('/login');
    } catch (e) {
        console.error("Lỗi mã hóa/LowDB:", e);
        req.flash('error', 'Lỗi hệ thống khi tạo tài khoản.');
        res.redirect('/register');
    }
});

// --- TRANG ĐĂNG NHẬP (GET /login) ---
app.get('/login', (req, res) => {
    const bodyContent = `
        <h1>Đăng Nhập</h1>
        <form method="POST" action="/login">
            <label for="username">Tên người dùng:</label>
            <input type="text" id="username" name="username" required><br>
            
            <label for="password">Mật khẩu:</label>
            <input type="password" id="password" name="password" required><br>
            
            <button type="submit" class="button-primary">Đăng Nhập</button>
        </form>
    `;
    res.send(renderHTML('Đăng Nhập', bodyContent, req, res.locals.username));
});

// --- XỬ LÝ ĐĂNG NHẬP (POST /login) ---
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = app.locals.db;
    
    // Tìm user
    const user = db.data.users.find(u => u.username === username);

    if (!user) {
        req.flash('error', 'Tên người dùng hoặc mật khẩu không đúng.');
        return res.redirect('/login');
    }

    try {
        const match = await bcrypt.compare(password, user.passwordHash);
        if (match) {
            req.session.userId = user.id; // Lưu ID người dùng vào Session
            req.flash('success', `Chào mừng ${username}!`);
            console.log(`[LOGIN] Đăng nhập thành công: ${username}`);
            res.redirect('/');
        } else {
            req.flash('error', 'Tên người dùng hoặc mật khẩu không đúng.');
            res.redirect('/login');
        }
    } catch (e) {
        console.error("Lỗi xác minh mật khẩu:", e);
        req.flash('error', 'Lỗi hệ thống khi đăng nhập.');
        res.redirect('/login');
    }
});

// --- XỬ LÝ ĐĂNG XUẤT (GET /logout) ---
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Lỗi khi hủy session:', err);
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); 
        req.flash('success', 'Bạn đã đăng xuất thành công.');
        res.redirect('/');
    });
});


// --- KHỞI ĐỘNG SERVER ---
app.listen(PORT, () => {
    console.log(`✅ Server đang chạy trên cổng ${PORT}`);
});
