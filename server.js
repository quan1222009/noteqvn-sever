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
// Lấy cổng từ biến môi trường (cần thiết cho Render) hoặc dùng 3000
const PORT = process.env.PORT || 3000; 
const saltRounds = 10; 
const DB_FILE = 'db.json'; // Tên file Database JSON

// --- Cấu hình LowDB (JS-only) ---
let db;
try {
    const adapter = new JSONFile(DB_FILE);
    // Khởi tạo dữ liệu mặc định nếu file trống
    const defaultData = { users: [], notes: [] }; 
    db = new Low(adapter, defaultData);
    
    db.read();
    
    // Nếu db.data rỗng, gán lại giá trị mặc định và ghi
    if (!db.data || !db.data.users || !db.data.notes) {
        db.data = defaultData;
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
    // Sử dụng biến môi trường (nếu có) hoặc chuỗi cứng
    secret: process.env.SESSION_SECRET || 'daylakhobimathoacsession', 
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

// CSS TỔNG THỂ 
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
        flex-direction: column; 
        align-items: flex-start;
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

    const errorMessages = req.flash('error');
    const successMessages = req.flash('success');
    
    let flashMessages = '';
    if (errorMessages.length > 0) {
        flashMessages += `<p class="error-message">${errorMessages.join('<br>')}</p>`;
    }
    if (successMessages.length > 0) {
        flashMessages += `<p class="success-message">${successMessages.join('<br>')}</p>`;
    }

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

// ------------------------------------
// --- CÁC ROUTES CỦA ỨNG DỤNG ---
// ------------------------------------

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
        await db.write(); 
        
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
    
    const user = db.data.users.find(u => u.username === username);

    if (!user) {
        req.flash('error', 'Tên người dùng hoặc mật khẩu không đúng.');
        return res.redirect('/login');
    }

    try {
        const match = await bcrypt.compare(password, user.passwordHash);
        if (match) {
            req.session.userId = user.id; 
            req.flash('success', `Chào mừng ${username}!`);
            console.log(`[LOGIN] Đăng nhập thành công: ${username}`);
            res.redirect('/mynotes'); 
        } else {
            req.flash('error', 'Tên người dùng hoặc mật khẩu không đúng.');
            res.redirect('/login');
        }
    } catch (e) {
        console.error("Lỗi so sánh mật khẩu:", e);
        req.flash('error', 'Lỗi hệ thống khi đăng nhập.');
        res.redirect('/login');
    }
});

// --- XỬ LÝ ĐĂNG XUẤT (GET /logout) ---
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Lỗi khi hủy session:', err);
        }
        res.redirect('/');
    });
});

// --- TRANG CHỦ & TẠO GHI CHÚ (GET /) ---
app.get('/', (req, res) => {
    const bodyContent = `
        <h1>📝 NoteQVn - Ghi Chú Nhanh Chóng</h1>
        ${res.locals.isLoggedIn ? `<p>Bạn có thể tạo ghi chú cá nhân và xem chúng tại <a href="/mynotes">Trang của tôi</a>.</p>` : `<p>Vui lòng <a href="/login">Đăng nhập</a> hoặc <a href="/register">Đăng ký</a> để lưu trữ ghi chú cá nhân.</p>`}
        
        <h2>Tạo Ghi Chú Nhanh (Công khai/Không cần đăng nhập)</h2>
        <form method="POST" action="/create">
            <textarea name="content" rows="8" placeholder="Nhập nội dung ghi chú của bạn..." required></textarea><br>
            <button type="submit" class="button-primary">Lưu Ghi Chú</button>
        </form>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">*Ghi chú được tạo khi chưa đăng nhập sẽ là **ghi chú tạm thời** và không thể xóa hoặc quản lý sau này.</p>
    `;
    res.send(renderHTML('Trang Chủ', bodyContent, req, res.locals.username));
});

// --- XỬ LÝ TẠO GHI CHÚ MỚI (POST /create) ---
app.post('/create', async (req, res) => {
    const { content } = req.body;
    const db = app.locals.db;
    
    if (!content || content.trim() === '') {
        req.flash('error', 'Nội dung ghi chú không được để trống.');
        return res.redirect('/');
    }

    const noteId = nanoid(8);
    const userId = req.session.userId || null; 
    const username = res.locals.username;

    const newNote = {
        id: noteId,
        content: content.trim(),
        userId: userId,
        username: userId ? username : 'Guest',
        createdAt: new Date().toISOString()
    };
    
    db.data.notes.push(newNote);
    await db.write();

    req.flash('success', 'Ghi chú đã được lưu thành công!');
    console.log(`[NOTE] Tạo ghi chú mới (ID: ${noteId}) bởi: ${newNote.username}`);
    res.redirect(`/note/${noteId}`);
});

// --- TRANG GHI CHÚ CÁ NHÂN (GET /mynotes) ---
app.get('/mynotes', isAuthenticated, (req, res) => {
    const db = app.locals.db;
    const myNotes = db.data.notes
        .filter(n => n.userId === req.session.userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    let notesListHTML = '';
    if (myNotes.length === 0) {
        notesListHTML = '<p>Bạn chưa có ghi chú cá nhân nào. Hãy tạo một cái!</p>';
    } else {
        notesListHTML = myNotes.map(note => `
            <div class="note-item">
                <p><b>ID:</b> ${note.id} - ${new Date(note.createdAt).toLocaleString()}</p>
                <div class="note-box" style="margin-bottom: 5px;">${note.content.substring(0, 150)}...</div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <a href="/note/${note.id}" class="button-primary" style="padding: 5px 10px; font-size: 14px;">Xem Chi Tiết</a>
                    <form method="POST" action="/note/${note.id}/delete" style="margin: 0;">
                        <button type="submit" class="button-primary" style="background-color: #dc3545; padding: 5px 10px; font-size: 14px;" onclick="return confirm('Bạn có chắc muốn xóa ghi chú này?');">Xóa</button>
                    </form>
                </div>
            </div>
        `).join('');
    }
    
    const bodyContent = `
        <h1>📝 Ghi Chú Của ${res.locals.username}</h1>
        ${notesListHTML}
        <a href="/" class="button-primary" style="margin-top: 20px;">+ Tạo Ghi Chú Mới</a>
    `;
    res.send(renderHTML('Ghi Chú Của Tôi', bodyContent, req, res.locals.username));
});

// --- XỬ LÝ XÓA GHI CHÚ (POST /note/:id/delete) ---
app.post('/note/:id/delete', isAuthenticated, async (req, res) => {
    const noteId = req.params.id;
    const db = app.locals.db;

    // 1. Tìm index của ghi chú
    const noteIndex = db.data.notes.findIndex(n => n.id === noteId);

    if (noteIndex === -1) {
        req.flash('error', 'Ghi chú không tồn tại.');
        return res.redirect('/mynotes');
    }

    // 2. Kiểm tra quyền sở hữu
    const note = db.data.notes[noteIndex];
    if (note.userId !== req.session.userId) {
        req.flash('error', 'Bạn không có quyền xóa ghi chú này.');
        return res.redirect('/mynotes');
    }

    // 3. Xóa và lưu
    db.data.notes.splice(noteIndex, 1);
    await db.write();

    req.flash('success', `Ghi chú ID ${noteId} đã được xóa.`);
    console.log(`[NOTE] Đã xóa ghi chú: ${noteId} bởi ${res.locals.username}`);
    res.redirect('/mynotes');
});


// --- TRANG XEM NỘI DUNG THÔ (GET /note/raw/:id) - CHỨC NĂNG RAW MỚI ---
app.get('/note/raw/:id', (req, res) => {
    const noteId = req.params.id;
    const db = app.locals.db;

    const note = db.data.notes.find(n => n.id === noteId);

    if (!note) {
        // Trả về 404 Not Found dưới dạng text/plain
        return res.status(404).set('Content-Type', 'text/plain').send('404 Not Found: Note not found');
    }

    // Thiết lập Content-Type là text/plain để hiển thị nội dung thô
    res.set('Content-Type', 'text/plain').send(note.content);
});


// --- TRANG XEM GHI CHÚ ĐỘC LẬP (GET /note/:id) - ĐÃ CẬP NHẬT GIAO DIỆN LINK RAW ---
app.get('/note/:id', (req, res) => {
    const noteId = req.params.id;
    const db = app.locals.db;
    
    const note = db.data.notes.find(n => n.id === noteId);
    
    if (!note) {
        req.flash('error', `Không tìm thấy ghi chú với ID: ${noteId}`);
        return res.redirect('/');
    }

    // ⭐ TẠO LIÊN KẾT ĐỘNG
    const host = req.get('host');
    const protocol = req.protocol;
    const fullShareLink = `${protocol}://${host}/note/${note.id}`;
    const rawLink = `${protocol}://${host}/note/raw/${note.id}`; 

    const isOwner = req.session.userId === note.userId;
    const deleteButton = isOwner ? `
        <form method="POST" action="/note/${note.id}/delete" style="display: inline-block;">
            <button type="submit" class="button-primary" style="background-color: #dc3545; margin-left: 10px;" onclick="return confirm('Bạn có chắc muốn xóa ghi chú này?');">Xóa Ghi Chú</button>
        </form>` : '';

    const bodyContent = `
        <h1>Ghi Chú #${note.id}</h1>
        <p><b>Người Tạo:</b> ${note.username} - <b>Thời gian:</b> ${new Date(note.createdAt).toLocaleString()}</p>
        
        <div class="note-box">
            ${note.content}
        </div>

        <div style="margin-top: 15px; margin-bottom: 15px;">
            <h3>Liên kết Chia sẻ & API</h3>
            <div class="link-box" style="flex-direction: column; align-items: flex-start;">
                <p style="margin: 5px 0; width: 100%; display: flex; justify-content: space-between; align-items: center;">
                    <b>Chia sẻ:</b> <a href="${fullShareLink}">${fullShareLink}</a>
                    <button class="copy-button" onclick="copyLink('${fullShareLink}')">Sao Chép</button>
                </p>
                <hr style="width: 100%; border: 0; border-top: 1px dashed #ccc; margin: 10px 0;">
                <p style="margin: 5px 0; width: 100%; display: flex; justify-content: space-between; align-items: center;">
                    <b>RAW (API):</b> <a href="${rawLink}" target="_blank">${rawLink}</a>
                    <button class="copy-button" onclick="copyLink('${rawLink}')">Sao Chép</button>
                </p>
            </div>
        </div>

        <div style="margin-top: 20px;">
            <a href="/" class="button-primary">Trang Chủ</a>
            ${isOwner ? `<a href="/mynotes" class="button-primary" style="margin-left: 10px;">Ghi Chú Của Tôi</a>` : ''}
            ${deleteButton}
        </div>

        <script>
            function copyLink(linkToCopy) {
                // Kiểm tra xem trình duyệt có hỗ trợ API clipboard không
                if (!navigator.clipboard) {
                    // Fallback cho trình duyệt cũ hơn (tùy chọn)
                    return alert('Trình duyệt không hỗ trợ sao chép tự động. Vui lòng sao chép thủ công: ' + linkToCopy);
                }
                
                navigator.clipboard.writeText(linkToCopy).then(() => {
                    alert('Đã sao chép liên kết!');
                }, (err) => {
                    console.error('Không thể sao chép: ', err);
                    alert('Lỗi khi sao chép liên kết.');
                });
            }
        </script>
    `;
    res.send(renderHTML(`Ghi Chú #${note.id}`, bodyContent, req, res.locals.username));
});

// --- Khởi Chạy Server ---
app.listen(PORT, () => {
    console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
    console.log(`💡 Để tạo ghi chú, truy cập http://localhost:${PORT}`);
});
