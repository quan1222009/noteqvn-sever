// Tiếp theo phần code bạn cung cấp (bắt đầu sau phần code gốc của POST /login)

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
            res.redirect('/mynotes'); // Chuyển hướng đến trang ghi chú cá nhân
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
    const userId = req.session.userId || null; // ID người tạo (hoặc null nếu chưa đăng nhập)
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

// --- TRANG XEM GHI CHÚ ĐỘC LẬP (GET /note/:id) (ĐÃ SỬA LỖI URL ĐỘNG CHO RENDER) ---
app.get('/note/:id', (req, res) => {
    const noteId = req.params.id;
    const db = app.locals.db;
    
    const note = db.data.notes.find(n => n.id === noteId);
    
    if (!note) {
        req.flash('error', `Không tìm thấy ghi chú với ID: ${noteId}`);
        return res.redirect('/');
    }

    // ⭐ SỬA LỖI URL: Dùng req.protocol và req.get('host') để có tên miền động
    const fullShareLink = `${req.protocol}://${req.get('host')}/note/${note.id}`;

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

        <div class="link-box">
            <span>Link chia sẻ: ${fullShareLink}</span>
            <button class="copy-button" onclick="copyLink()">Sao Chép</button>
        </div>

        <div style="margin-top: 20px;">
            <a href="/" class="button-primary">Trang Chủ</a>
            ${isOwner ? `<a href="/mynotes" class="button-primary" style="margin-left: 10px;">Ghi Chú Của Tôi</a>` : ''}
            ${deleteButton}
        </div>

        <script>
            function copyLink() {
                // Sử dụng link đã được tạo động
                const link = '${fullShareLink}'; 
                navigator.clipboard.writeText(link).then(() => {
                    alert('Đã sao chép liên kết ghi chú!');
                }, (err) => {
                    console.error('Không thể sao chép: ', err);
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
    console.log(`💡 Để đăng ký, truy cập http://localhost:${PORT}/register`);
});
