const socket = io("https://192.168.1.8:3000/");

socket.on('Ngat', e => {
    $.notify(`${e} đã ngắt kết nối`);
});
socket.on('User_out_room_status', e=>{
    $.notify(`${e} đã rời khỏi phòng`);
});
socket.on('User_join_room_status', e=>{
    $.notify(`${e} đã vào phòng`,"success");
});

socket.on('List_user',e=>{
    $("#user_online").html(`Số lượng người online: ${e} `);
});

socket.on('Danhsachphong', list => {
    console.log(list);
    $("#room_list > tbody").html("");
    for (var i = 0; i < list.length; i++) {
        var trangthai = list[i].password == "" ? 'Public' : 'Private';
        $("#room_list > tbody").append(`<tr id="room_${list[i].roomid}">
                                            <td> ${list[i].roomid} </td>
                                            <td> ${list[i].roomname} </td>
                                            <td> ${trangthai} </td>
                                            <td> ${list[i].who}/${list[i].size} </td>
                                        </tr>
        `);
    };
});

socket.on('Sign_up_status', e => {
    if (e.status) {
        $.notify("Đăng ký thành công", "success");
        $("#hello-user").append(`Xin chào, ${e.name}`);
        $("#chat_area").show();
        $("#signup_area").hide();
    } else {
        $.notify("Tên người dùng đã tồn tại");
    };
});

socket.on('Create_room_status', e => {
    $.notify(e.message, "success");
    $("#room_area").hide();
    $("#video_area").show();
    $("#btn-call").show();
    $("#btn-out").show();
    $("#video_area").append(`<div id="div_${e.videoid}">
        <video id="${e.videoid}" class="col-lg-6 video_call" controls poster="https://png.pngtree.com/templates/md/20180515/md_5afade8468599.png"> </video>
    </div>`);
});

socket.on('Join_room_status', e => {
    if (e.status) {
        $.notify(e.message, "success");
        $("#room_area").hide();
        $("#video_area").show();
        $("#btn-out").show();
        $("#video_area").append(`<div id="div_${e.videoid}">
            <video id="${e.videoid}" class="col-lg-6 video_call" controls poster="https://png.pngtree.com/templates/md/20180515/md_5afade8468599.png"> </video>
        </div>`);
    } else {
        $.notify(e.message);
    }
});

var peer = new Peer({ key: 'lwjd5qra8257b9' });

peer.on('open', id => {

    $("#my-peer").append(`Id: ${id}`);

    // Sign up
    $("#btn_signup").on('click', () => {
        if (document.getElementById("user_name").value.length > 0) {
            socket.emit("Sign_up", { username: document.getElementById("user_name").value, peerid: id, socketid: socket.id });
        } else {
            alert('tên người dùng chưa nhập');
        }
    });
    // Create room
    $("#btn_create_room").off('click').on('click', function () {
        socket.emit('Create_room', {
            roomname: document.getElementById("room_name").value,
            password: document.getElementById("pass_word").value,
            size: document.getElementById("demo").innerHTML
        });
    });
    // Join room
    $("#room_list > tbody").on('click', 'tr', function () {
        var room = $(this).attr('id');
        var t = room.slice(5, room.length);
        socket.emit('Join_room', t);
    });

    socket.on('Update_room', e => {
        for (var i = 0; i < e.length; i++) {
            if (e[i] != peer.id)
                $("#video_area").append(`<div id="div_${e[i]}">
                <video id="${e[i]}" class="col-lg-3 video_call" controls poster="https://png.pngtree.com/templates/md/20180515/md_5afade8468599.png"> </video>
            </div>`);
        }
    });
    socket.on('Update_user', e => {
        $("#video_area").append(`<div id="div_${e}">
                <video id="${e}" class="col-lg-3 video_call" controls poster="https://png.pngtree.com/templates/md/20180515/md_5afade8468599.png"> </video>
            </div>`);
    });
    socket.on('Disconnect_room', e => {

        $(`#div_${e.user}`).remove();
        if(e.room.owner == socket.id){
            $("#btn-call").show();
            $.notify("Bạn đã thành trưởng phòng","success");
        }
    });

    $("#btn-call").on('click', function () {
        var list = document.getElementsByClassName('video_call');
        var t = [];
        for(var i=0;i<list.length;i++){
            t.push(list[i].getAttribute('id'));
        }
        socket.emit('List_call_room', t);
    });

    $("#btn-out").on('click',function(){
        $(this).hide();
        $("#video_area").html("");
        $("#video_area").hide();
        $("#btn-call").hide();
        $("#room_area").show();
        socket.emit("User_out_room",peer.id);
    });

    socket.on('List_call_room_client', list => {
        openStream().then(stream => {
            playStream(peer.id, stream); // hiện video của người dùng.
            socket.on('user_stop_call', e =>{
                if (stream.getVideoTracks().length > 0) stream.getVideoTracks()[0].stop();
                if (stream.getAudioTracks().length > 0) stream.getAudioTracks()[0].stop();
            }); 
            var index = list.findIndex(l => l == peer.id);
            var call = [];
            for (var i = index + 1; i < list.length; i++) {
                call.push(peer.call(list[i], stream));
            };
            call.forEach(t => {          
                t.on('stream',stream2 => {
                    playStream(`${t.peer}`,stream2);
                });
            });
        });
    });

    peer.on('call', call => {
        openStream().then(stream => {
            call.answer(stream);
            call.on('stream', remoteStream => {
                playStream(`${call.peer}`, remoteStream);
                socket.on('user_stop_call', e =>{
                    if (stream.getVideoTracks().length > 0) stream.getVideoTracks()[0].stop();
                    if (stream.getAudioTracks().length > 0) stream.getAudioTracks()[0].stop();
                }); 
            });
        });
    });

    $("#btn-send-all").on('click',function(){
        socket.emit('Chat_all', {peer:peer.id,message:document.getElementById("text-send-all").value});
        document.getElementById("text-send-all").value = "";
    });
    $('#text-send-all').keypress(function(event){
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if(keycode == '13'){
            socket.emit('Chat_all', {peer:peer.id,message:document.getElementById("text-send-all").value});
            document.getElementById("text-send-all").value = "";
        }
    });
    $("#btn-send-room").on('click',function(){
        socket.emit('Chat_room', {peer:peer.id,message:document.getElementById("text-send-room").value});
        document.getElementById("text-send-room").value = "";
    });
    $("#text-send-room").on('click',function(){
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if(keycode == '13'){
            socket.emit('Chat_room', {peer:peer.id,message:document.getElementById("text-send-room").value});
            document.getElementById("text-send-room").value = "";
        }
    });
    socket.on('Chat_all_client', e=>{
        $("#text-chat-all").append(`<b>${e.name}:</b> ${e.message} </br>`);
        var objDiv = document.getElementById("text-chat-all");
        objDiv.scrollTop = objDiv.scrollHeight;
    });
    socket.on('Chat_room_client', e=>{
        $("#text-chat-room").append(`<b>${e.name}:</b> ${e.message} </br>`);
        var objDiv = document.getElementById("text-chat-room");
        objDiv.scrollTop = objDiv.scrollHeight;
    });
    socket.on('add_image_all', base64image => {
        var type = base64image.file.type;
        var add;
        if (type.includes("image")) {
            add = `<img src="${base64image.data}" style="max-height:200px"/>`;
        } else {
            add = ` [${base64image.file.name}] `;
        };
        $("#text-chat-all").append(`<div> <b> ${base64image.name}:</b> <a target="_blank" href="${base64image.data}" download>` + add + `</a> </div>`);
    });

    $("#btn-file-all").on('change', function (e) {
        var file = e.originalEvent.target.files[0];
        var t = {};
        t.name = file.name;
        t.type = file.type;
        t.size = file.size;
        if (file.size <= 104857600) {
            var reader = new FileReader();

            // reader.onloadstart = function (e) {
            //     $("#progressBar").show();
            //     $("#loaded_n_total").show();
            // };

            reader.onload = function (evt) {
                console.log('a');
                socket.emit('user_image_all', { data: evt.target.result, file: t,peer:peer.id });
            };

            reader.onprogress = function (data) {
                console.log(data.loaded);
                if (data.lengthComputable) {
                    var progress = parseInt(((data.loaded / data.total) * 100), 10);
                    document.getElementById('progressBar').value = progress;
                    document.getElementById('loaded_n_total').innerHTML = `${progress}/100`;
                }
            }
            // reader.onloadend = function (data) {
            //     $("#progressBar").hide();
            //     $("#loaded_n_total").hide();
            // };

            reader.readAsDataURL(file);
        }else{
            alert('kích thước file tối đa 100MB');
        }
    });
});

function openStream() {
    const config = {
        audio: true,
        video: true
    }
    return navigator.mediaDevices.getUserMedia(config);
}

function playStream(idVideoTag, stream) {
    const video = document.getElementById(idVideoTag);
    video.srcObject = stream;
    video.play();
}