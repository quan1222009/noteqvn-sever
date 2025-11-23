// File: server.js (Phiên bản Hoàn Chỉnh sử dụng lowdb/JSON)
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs'); // Vẫn dùng bcryptjs vì không cần biên dịch
const { nanoid } = require('nanoid'); 
// LOWDB Imports
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10; 
const DB_FILE = 'db.json'; // Tên file Database JSON

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
    cookie: { maxAge: 60 * 60 * 1000 }
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
            return res.redirect('/');
        } else {
            req.flash('error', 'Tên người dùng hoặc mật khẩu không đúng.');
            return res.redirect('/login');
        }
    } catch (e) {
        console.error("Lỗi so sánh mật khẩu:", e);
        req.flash('error', 'Lỗi hệ thống khi đăng nhập.');
        res.redirect('/login');
    }
});

// --- ĐĂNG XUẤT (GET /logout) ---
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Lỗi đăng xuất:", err);
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); 
        res.redirect('/login');
    });
});

// --- TRANG HIỂN THỊ NOTES ĐÃ LƯU (GET /mynotes) ---
app.get('/mynotes', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const db = app.locals.db;

    // Lọc ghi chú và sắp xếp theo thời gian mới nhất
    const userNotes = db.data.notes
        .filter(note => note.userId === userId)
        .sort((a, b) => b.timestamp - a.timestamp);
    
    let notesList = '';
    if (userNotes.length === 0) {
        notesList = '<p>Bạn chưa có ghi chú nào.</p>';
    } else {
        notesList = userNotes.map(note => {
            const date = new Date(note.timestamp).toLocaleString();
            const snippet = note.content.substring(0, 50).trim() + (note.content.length > 50 ? '...' : ''); 
            return `
                <div class="note-item">
                    <p><b>[${date}]</b> <a href="/${note.id}">Xem ghi chú ID: ${note.id}</a></p>
                    <p style="margin-left: 10px; font-size: 0.9em; color: #555;">${snippet}</p>
                </div>
            `;
        }).join('');
    }

    const bodyContent = `
        <h1>📖 Ghi Chú Của Tôi</h1>
        <p>Tổng cộng: ${userNotes.length} ghi chú.</p>
        <div style="width: 100%; max-width: 500px; margin: auto;">
            ${notesList}
        </div>
        <a href="/" class="button-primary" style="background-color: #6c757d;">➕ Thêm Ghi Chú Mới</a>
    `;
    res.send(renderHTML('Ghi Chú Của Tôi', bodyContent, req, res.locals.username));
});

// --- TRANG CHỦ (GET /) ---
app.get('/', (req, res) => {
    const bodyContent = `
        <h1>✍️ Tạo Ghi Chú Mới</h1>
        <p>${req.session.userId ? 'Ghi chú sẽ được lưu vào file JSON.' : 'Vui lòng đăng nhập để lưu ghi chú.'}</p>
        <form method="POST" action="/save">
            <textarea name="content" rows="10" cols="50" placeholder="Nhập ghi chú của bạn..."></textarea><br>
            <button type="submit" class="button-primary" ${req.session.userId ? '' : 'disabled'} title="${req.session.userId ? '' : 'Vui lòng đăng nhập'}">💾 Lưu Ghi Chú</button>
        </form>
    `;
    res.send(renderHTML('Trang Chủ', bodyContent, req, res.locals.username));
});

// --- XỬ LÝ LƯU GHI CHÚ (POST /save) ---
app.post('/save', isAuthenticated, async (req, res) => {
    const content = req.body.content;
    const userId = req.session.userId;
    const db = app.locals.db;

    if (!content) {
        req.flash('error', 'Ghi chú không được để trống.');
        return res.redirect('/');
    }

    try {
        const noteId = nanoid(8); 
        const timestamp = Date.now();
        
        // Thêm ghi chú vào mảng notes
        db.data.notes.push({ id: noteId, content, userId, timestamp });
        await db.write(); // Lưu thay đổi vào file JSON
        
        console.log(`[SAVE] Note ID ${noteId} đã lưu bởi User ID: ${userId} vào JSON.`);
        req.flash('success', 'Ghi chú đã được lưu thành công!');
        res.redirect(`/${noteId}`); 
    } catch (e) {
        console.error("Lỗi LowDB khi lưu ghi chú:", e);
        req.flash('error', 'Lỗi hệ thống khi lưu ghi chú.');
        res.redirect('/');
    }
});

// --- Hiển Thị Ghi Chú Đã Lưu (GET /:id) ---
app.get('/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const userId = req.session.userId;
    const db = app.locals.db;

    // Lấy ghi chú
    const note = db.data.notes.find(n => n.id === id && n.userId === userId);
    
    if (!note) {
        req.flash('error', 'Ghi chú không tồn tại hoặc bạn không có quyền truy cập.');
        return res.redirect('/');
    }
    
    const displayContent = note.content.replace(/\n/g, '<br>');
    const fullLink = `http://localhost:${PORT}/${id}`; 
    const rawLink = `/raw/${id}`;

    const bodyContent = `
        <h1>✅ Ghi Chú Đã Lưu</h1>
        <h2>ID: ${id}</h2>
        
        <div class="note-box">${displayContent}</div>

        <p>Đường dẫn ghi chú của bạn:</p>
        <div class="link-box">
            <span id="noteLink">${fullLink}</span>
            <button class="copy-button" onclick="copyLink()">📋 Copy Link</button>
        </div>

        <p>Link RAW (Text thuần):</p>
        <a href="${rawLink}">http://localhost:${PORT}${rawLink}</a>
        
        <hr style="width:100%; border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        
        <a href="/" class="button-primary" style="background-color: #6c757d;">➕ Thêm Ghi Chú Mới</a>

    <script>
        function copyLink() {
            const linkElement = document.getElementById('noteLink');
            const linkText = linkElement.textContent;
            navigator.clipboard.writeText(linkText).then(() => {
                alert("Đã sao chép đường link: " + linkText);
            }).catch(err => {
                console.error('Không thể sao chép: ', err);
                prompt("Sao chép thủ công:", linkText);
            });
        }
    </script>
    `;
    res.send(renderHTML(`Note ID: ${id}`, bodyContent, req, res.locals.username));
});

// --- Link RAW (GET /raw/:id) ---
app.get('/raw/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const userId = req.session.userId;
    const db = app.locals.db;

    const note = db.data.notes.find(n => n.id === id && n.userId === userId);

    if (!note) {
        return res.status(404).send("Lỗi 404: Không tìm thấy nội dung RAW hoặc bạn không có quyền.");
    }

    res.set('Content-Type', 'text/plain');
    res.send(note.content);
});


 // Khởi động server
app.listen(PORT, () => {
    console.log(`✅ Server NoteQVn đã khởi động thành công!`);
    console.log(`📢 Truy cập tại: http://localhost:${PORT}`);
    console.log(`*** Dữ liệu được lưu vào file ${DB_FILE} ***`);
});
