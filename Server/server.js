var express = require('express');
var app = express();
var fs = require('fs');

var key = fs.readFileSync('D:/RealtimeWeb/Room/Server/server.key');
var cert = fs.readFileSync('D:/RealtimeWeb/Room/Server/server.cert');

var options = {
    key: key,
    cert: cert,
};


var server = require('https').createServer(options,app);
var server2 = require('https').createServer(options,app);

const io = require('socket.io')(server2);

var bodyParser = require('body-parser');

var urlendcodeParser = bodyParser.urlencoded({ extended: false });

app.get('/', function (req, res) {
    res.sendFile("D:/RealtimeWeb/Room/Sources/index.html");
});

app.use(express.static("D:/RealtimeWeb/Room/Sources"));

server.listen(8000);
server2.listen(3000);

var listuser = []; // Chứa thông tin người dùng  User {Username, PeerId, SocketId, RoomId}

var listroom = []; // danh sách phòng Room {RoomId, RoomName, PassWord, Size, Who, Owner}

var empty_room = [];


io.on('connection', socket => {
    // console.log(socket.id);
    socket.emit('Danhsachphong', listroom);
    io.emit('List_user',listuser.length);
    
    // Sign up

    socket.on("Sign_up", user => {
        const IsExist = listuser.some(e => e.username === user.username); // Check user is Existed ?
        if (!IsExist) {
            listuser.push(user);
            io.emit('List_user',listuser.length);
            socket.emit("Sign_up_status", { status: 1, message: 'Đăng ký thành công', name: user.username });
        } else {
            socket.emit("Sign_up_status", { status: 0, message: 'Đăng ký thất bại' });
        };
    });

    // Create room

    socket.on('Create_room', e => {
        if (empty_room.length > 0) {
        e.roomid = empty_room[0]; // gắn id phòng bằng phần tử đầu tiên trong mảng
        empty_room.shift(); // xóa phần tử đầu tiên khỏi mảng
        }else {
            e.roomid = listroom.length +1 ;
        }

        var index = listuser.findIndex(user => user.socketid === socket.id);

        if (index != -1) {
            socket.join(e.roomid); // thêm người dùng vào 1 phòng.
            listuser[index].roomid = e.roomid; // thêm roomid cho người dùng.
            e.who = socket.adapter.rooms[e.roomid].length; // số lượng người dùng online.
            e.owner = listuser[index].socketid; // chủ phòng.
            listroom.push(e);            // thêm phòng vào mảng.
            socket.emit('Create_room_status',{message:"tạo phòng thành công",videoid:listuser[index].peerid});
            io.emit('Danhsachphong', listroom);

        } else {

        };
    });

    // Join room
    
    socket.on('Join_room', id =>{
        var index = listroom.findIndex(room => room.roomid == id);
        if(listroom[index].who == listroom[index].size){
            socket.emit('Join_room_status',{status:0,message:"phòng đã đầy"});
        }else{
            socket.join(id);
            var t = listuser.findIndex(user => user.socketid == socket.id);
            listuser[t].roomid = id; // cập nhật phòng cho người dùng.
            listroom[index].who++; // cập nhật số lượng người trong phòng.
            
            var list_peer = [];
            var room = socket.adapter.rooms[id].sockets; // sockets in room, length
            for (var item in room){ // lấy từng socket trong room
                var tim = listuser.findIndex( thu => thu.socketid == item); // tìm từng phần tử chứa socketid trong listuser
                list_peer.push(listuser[tim].peerid); // lấy ra peerid 
            }
            socket.emit('Join_room_status',{status:1,message:"Vào phòng thành công",videoid:listuser[t].peerid});
            socket.to(listuser[t].roomid).emit("User_join_room_status", listuser[t].username);

            socket.emit('Update_room', list_peer);
            socket.to(id).emit('Update_user', listuser[t].peerid);

            io.emit('Danhsachphong', listroom);
        }
    });

    socket.on('List_call_room', list =>{
        var index = listuser.findIndex(user => user.peerid == list[0]);
        io.in(listuser[index].roomid).emit('List_call_room_client',list);
    });

    // chat_all
    socket.on('Chat_all', e => {
        var index = listuser.findIndex(t => t.peerid == e.peer);

        io.emit('Chat_all_client',{name: listuser[index].username, message:e.message});
    });

    // chat_room
    socket.on('Chat_room', e => {
        var index = listuser.findIndex(t => t.peerid == e.peer);
        if(listuser[index].roomid !=undefined) io.in(listuser[index].roomid).emit('Chat_room_client',{name: listuser[index].username, message:e.message});

    });

    // send file

    socket.on('user_image_all',e =>{
        const index = listuser.findIndex(user => user.peerid == e.peer);
        io.emit('add_image_all',{file:e.file,data:e.data,name:listuser[index].username});
    });


    // Disconnected

    socket.on('disconnect', e => {
        const index = listuser.findIndex(user => user.socketid == socket.id);
        if (index != -1) {
            var check_room = listuser[index].roomid; 
            socket.leave(listuser[index].roomid);
            io.emit('Ngat', listuser[index].username); // thông báo người dùng thoát.
            
            var peer_delete = listuser[index].peerid; // xóa peer của người dùng ngắt kết nối

            listuser.splice(index, 1); // xóa người dùng khỏi danh sách.

            if(check_room != undefined){              
                const ex = listroom.findIndex(room => room.roomid == check_room); // kiểm tra còn người dùng khác trong phòng.           
                if (ex != -1){ // nếu phòng tồn tại.
                    if(listroom[ex].who == 1) listroom.splice(ex, 1); // chỉ còn 1 người trong phòng -> xóa phòng khỏi danh sách.
                    else{
                        listroom[ex].who--; // cập nhật sl người trong phòng.
                        const k = listuser.findIndex(user => user.roomid == check_room);
                        listroom[ex].owner = listuser[k].socketid; //cap nhat chu phòng.
                        socket.to(check_room).emit('Disconnect_room',{user:peer_delete,room:listroom[ex]});
                    }                
                }
            };
            io.emit('Danhsachphong', listroom);
            io.emit('List_user',listuser.length);
        };
    });
    socket.on('User_out_room', e=>{
        const index = listuser.findIndex(user => user.peerid == e); // tìm người dùng vừa thoát khỏi phòng.
        
        if (index != -1) {
            var check_room = listuser[index].roomid; // xuất ra phòng thoát
            socket.leave(listuser[index].roomid);
            socket.to(listuser[index].roomid).emit('User_out_room_status', listuser[index].username); // thong bao

            listuser[index].roomid = undefined; // reset phòng cho người dùng.

            var peer_delete = listuser[index].peerid;

            // listuser.splice(index, 1); // xóa người dùng khỏi danh sách.

            if(check_room != undefined){              
                const ex = listroom.findIndex(room => room.roomid == check_room); // lấy ra room
                if (ex != -1){ // nếu phòng tồn tại.
                    if(listroom[ex].who == 1) listroom.splice(ex, 1); // chỉ còn 1 người trong phòng -> xóa phòng khỏi danh sách.
                    else{
                        listroom[ex].who--; // cập nhật sl người trong phòng.
                        const k = listuser.findIndex(user => user.roomid == check_room);
                        listroom[ex].owner = listuser[k].socketid; //cap nhat chu phòng.
                        socket.to(check_room).emit('Disconnect_room',{user:peer_delete,room:listroom[ex]});
                    }                
                }
            };
            io.emit('Danhsachphong', listroom);
            io.emit('List_user',listuser.length);
            socket.emit('user_stop_call', e);
        };
    });
});
