---
layout: post
current: post
cover: assets/images/derived-state-of.png
navigation: True
title: derivedStateOf vs remember(key) Chúng nó rất khác nhau đấy
date: 2025-02-28 10:18:00
tags: compose
class: post-template
subclass: 'post'
author: kendis
---

derivedStateOf VS. remember(key) - Chúng nó rất khác nhau đấy.

Trong Jetpack Compose, derivedStateOf và remember(key) là hai khái niệm quan trọng giúp tối ưu hiệu suất và quản lý trạng thái hiệu quả.

## Khái niệm và cách sử dụng của derivedStateOf và remember

**derivedStateOf** là một cách để tạo ra một trạng thái (**state**) mới dựa trên các giá trị hiện tại của một hoặc nhiều state khác mà bạn đã khai báo trong **Compose**. Mục đích chính của **derivedStateOf** là để tính toán lại giá trị của trạng thái dựa trên sự thay đổi của các trạng thái phụ thuộc mà không phải thực hiện tính toán lại mỗi lần khi không cần thiết. Điều này giúp tối ưu hóa hiệu suất.


**remember** là một hàm trong **Compose** được sử dụng để lưu trữ giá trị hoặc trạng thái qua các lần **recompose** (thay đổi giao diện). Khi một giá trị hoặc state được lưu trữ bằng **remember**, **Compose** sẽ nhớ lại giá trị đó giữa các lần vẽ lại UI, giúp tránh việc khởi tạo lại các giá trị không cần thiết, do đó cải thiện hiệu suất. Bạn cũng có thể sử dụng remember với một key để chỉ định trạng thái được "nhớ" theo một điều kiện cụ thể.

## Study case

Chúng ta sẽ đến với ví dụ sau để hiểu rõ hơn:

```
@Composable
fun ScrollToTopButton(
    state: LazyListState
) {
    val scope = rememberCoroutineScope()

	// Implement showScrollToTopButton here

    if(showScrollToTopButton) {
        FloatingActionButton(onClick = {
            scope.launch {
                state.animateScrollToItem(0)
            }
        }) {
            Icon(
                imageVector = Icons.Default.KeyboardArrowUp,
                contentDescription = null
            )
        }
    }
}
```
Giả sử như chúng ta có 1 list các item hiển thị trong ```LazyColumn```.

Đoạn code trên là một **Composable** function trong **Jetpack Compose**, có chức năng hiển thị một nút "Scroll to Top" (cuộn lên đầu) dưới dạng một **FloatingActionButton**. Mục đích của nút này là để khi nhấn vào nó, danh sách cuộn về đầu.

Function trên nhận vào ```lazyListState``` của ```Lazycolumn```.

Nhiệm vụ của chúng ta sẽ implement chức năng hiển thị nút ```FloatingActionButton``` lên nếu item đầu tiên của ```LazyColumn``` là item với index là 5 hoặc lớn hơn.


![Study case](assets/images/derived-state-of-1.png)

Trước tiên trong trường hợp này nhiều bạn có thể nghĩ đến remember và implement như sau:

```
@Composable
fun ScrollToTopButton(
    state: LazyListState
) {
    val scope = rememberCoroutineScope()

	val showScrollToTopButton = remember(state.firstVisibleItemIndex) {
	    state.firstVisibleItemIndex >= 5
	}

    if(showScrollToTopButton) {
        FloatingActionButton(onClick = {
            scope.launch {
                state.animateScrollToItem(0)
            }
        }) {
            Icon(
                imageVector = Icons.Default.KeyboardArrowUp,
                contentDescription = null
            )
        }
    }
}
```

Và bấm Run.

Mọi thứ chạy ổn, nhưng khoan. Có 1 thứ lạ. Ta thấy khi scroll ```FloatingActionButton``` recompose quá nhiều lần. Có vẻ không ổn.

Hãy thử sang **derivedStateOf**

```
@Composable
fun ScrollToTopButton(
    state: LazyListState
) {
    val scope = rememberCoroutineScope()

    val showScrollToTopButton by remember() {
        derivedStateOf {
            state.firstVisibleItemIndex >= 5
        }
    }

    if(showScrollToTopButton) {
        FloatingActionButton(onClick = {
            scope.launch {
                state.animateScrollToItem(0)
            }
        }) {
            Icon(
                imageVector = Icons.Default.KeyboardArrowUp,
                contentDescription = null
            )
        }
    }
}
```

Và Run lại.

Và chúng ta sẽ thấy hiện tượng trên sẽ không còn.

Vậy thì lý do là gì?

2 function này nghe có vẻ mục đích của nó là giống nhau. Đều lắng nghe thay đổi từ lazyListState và rồi tạo cập nhật giá trị cho ```showScrollToTopButton```.

Trong trường hợp này, chúng ta sẽ quan sát giá trị của ```state.firstVisibleItemIndex```. Mỗi khi giá trị này thay đổi, ```showScrollToTopButton``` sẽ được cập nhật, khiến Compose phải recompose lại. Tuy nhiên, điều này không phải là điều chúng ta mong muốn vì gây ra việc recompose không cần thiết.

Ta nhận thấy rằng giá trị của ```showScrollToTopButton``` chỉ là một **boolean** và nó chỉ thay đổi khi đạt một điều kiện nhất định, trường hợp trên là ```state.firstVisibleItemIndex >= 5```. Do đó, không cần phải cập nhật ```showScrollToTopButton``` mỗi khi ```firstVisibleItemIndex``` thay đổi.

Trong khi đó, với **derivedStateOf**, Compose sẽ kiểm tra lại giá trị mới và so sánh với giá trị cũ. Nếu giá trị mới giống với giá trị cũ, nó sẽ không gây ra việc cập nhật lại, từ đó tránh được việc recompose không cần thiết như trên.

## Tổng kết

Khi xem qua ví dụ trên, có thể một vài người sẽ nghĩ chuyện này đơn giản và không quan trọng. Tuy nhiên trong thực thế, với các dự án lớn thì việc sử dụng thích hợp giữa **derivedStateOf** VS. **remember(key)** sẽ giảm thiểu sự giật lag đi rất nhiều.
