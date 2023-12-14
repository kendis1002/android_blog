---
layout: post
current: post
cover: assets/images/coroutine-cancellation-exceptions.png
navigation: True
title: Exception trong coroutine
date: 2023-12-14 10:18:00
tags: coroutine
class: post-template
subclass: 'post'
author: kendis
---

Tất cả những điều bạn cần biết về exception trong coroutine

Chúng ta, những nhà phát triển, thường dành rất nhiều thời gian để trau chuốt cho con đường thuận khi phát triển ứng dụng. Tuy nhiên, cũng quan trọng không kém là cung cấp trải nghiệm người dùng tốt khi mọi thứ không diễn ra như mong đợi. Một mặt, việc thấy ứng dụng bị crash là một trải nghiệm tồi tệ đối với người dùng; mặt khác, hiển thị thông báo phù hợp cho người dùng khi một hành động không thành công là điều không thể thiếu.

Việc xử lý exception đúng cách có ảnh hưởng rất lớn đến cách người dùng cảm nhận ứng dụng của bạn. Trong bài viết này, chúng tôi sẽ giải thích cách exception được lan truyền trong coroutines và cách bạn luôn có thể kiểm soát, bao gồm các cách khác nhau để xử lý chúng.

##  Một coroutine bất ngờ bị fail! Làm gì bây giờ? 😱

Khi một coroutine gặp exception, nó sẽ truyền exception đó lên cho coroutine cha của nó! Sau đó, coroutine cha sẽ:
1. Hủy bỏ tất cả các coroutine con còn lại của nó.
2. Hủy bỏ chính nó.
3. Truyền exception lên cho coroutine cha của nó.
Lỗi sẽ tiếp tục lan truyền cho đến gốc của hệ thống phân cấp, và tất cả các coroutine được khởi tạo bởi ```CoroutineScope``` cũng sẽ bị hủy bỏ.

![Một exception trong một coroutine sẽ lan truyền xuyên suốt hệ thống phân cấp của các coroutine.](assets/images/coroutine-cancellation-exceptions-1.gif)

Mặc dù việc truyền tải exception có thể hợp lý trong một số trường hợp, nhưng cũng có những trường hợp khác mà nó không mong muốn. Hãy tưởng tượng một ```CoroutineScope``` liên quan đến UI chịu trách nhiệm xử lý các tương tác của người dùng. Nếu một coroutine con ném exception, phạm vi UI sẽ bị hủy bỏ và toàn bộ thành phần UI sẽ trở nên vô phản hồi vì Scope đã bị huỷ không thể khởi động thêm coroutine nào nữa.

Làm thế nào nếu bạn không muốn hành vi đó? Thay vào đó, bạn có thể sử dụng một triển khai khác của ```Job```, cụ thể là ```SupervisorJob```, trong ```CoroutineContext``` của ```CoroutineScope``` để tạo các coroutine này.



