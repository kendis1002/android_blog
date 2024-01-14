---
layout: post
current: post
cover: assets/images/viewmodelscope.png
navigation: True
title: 3 lỗi cần phải tránh khi sử dụng Jetpack Compose
date: 2023-12-08 10:18:00
tags: coroutine
class: post-template
subclass: 'post'
author: kendis
---

Dưới đây sẽ là một số lỗi cần phải tránh khi sử dụng **Jetpack Compose**.

## Sử dụng scroll state value
Không nên hard code **Dispatchers** khi tạo **coroutines** mới hoặc gọi với **withContext**.

```kotlin
@Composable
fun Mistake1() {
    val scrollState = rememberScrollState()
    Column (
        modifier = Modifier()
            .fillMaxSize()
            .verticalScroll(scrollState)
    ) {
        for (i in 1..20) {
            MyListItem(
                scrolloffset = scrollState.value.toFloat(),
                modifier = Modifier.fillMaxwidth()
            )
        }
    }
}
```

```kotlin
@Composable
fun MyListItem(
    scrollOffset: Float,
    modifier: Modifier = Modifier()
) {
    Text(
        text = "Scroll item",
        modifier = modifier
            .padding (32.dp)
            .graphicsLayer {
                translationX = scrollOffset
            }
    )
}
```

Thực ra đối với ví dụ trên thì sẽ không có thật ngoài thực tế đâu. Khi scroll thì item ```MyListItem``` sẽ di chuyển sang 2 bên.
Nhưng điều đáng nói ở đây là gì, lúc này, khi kiểm tra LayoutInspector và thực hiện scroll, ta thấy rằng ```MyListItem``` lại bị recomposing liên tục.

![```MyListItem``` bị recomposing liên tục](assets/images/3-mistakes-compose.png "```MyListItem``` bị recomposing liên tục")

Đây là lý do phổ biến mà nhiều người phàn nàn về việc **LazyColumn** hay cả **Scrollable** view bị lag. Và lý do là sử dụng scroll state không đúng.

Quay lại code của chúng ta để tìm hiểu tại sao lại xảy ra vấn đề này và tìm cách giải quyết. Chúng ta đã tạo 1 state và truyền nó sang 1 sub-component là ```MyListItem```. Mỗi lúc scrollState thay đổi thì ```MyListItem``` sẽ thay đổi bởi vì thực ra state truyền vào đã thay đổi rồi nên 1 compose như ```MyListItem``` biết là phải recompose lại.

Để sửa nó thì thay vì truyền scroll offset là 1 Float, chúng ta có thể truyền 1 lambda function, trả về Float và gọi lambda đó ở item. Ở compose cha thì ta sẽ thay state thành lambda luôn.

```kotlin
@Composable
fun Mistake1() {
    val scrollState = rememberScrollState()
    Column (
        modifier = Modifier()
            .fillMaxSize()
            .verticalScroll(scrollState)
    ) {
        for (i in 1..20) {
            MyListItem(
                scrolloffset = { scrollState.value.toFloat() },
                modifier = Modifier.fillMaxwidth()
            )
        }
    }
}
```

```kotlin
@Composable
fun MyListItem(
    scrollOffset: () -> Float,
    modifier: Modifier = Modifier()
) {
    Text(
        text = "Scroll item",
        modifier = modifier
            .padding (32.dp)
            .graphicsLayer {
                translationX = scrollOffset()
            }
    )
}
```

Thử lại xem, chúng ta đã không còn thấy các item bị recomposing khi scroll nữa. Lí do mà lambda có thể khắc phục vấn đề này là vì lambda khi được truyền qua các compose là reference, mà reference như thế thì không thay đổi. Mỗi lúc scroll thì lambda sẽ trả về giá trị offset cho ```MyListItem```.

Vậy, mỗi lúc mà bạn sử dụng 1 state trực tiếp ở graphic layer, bạn phải check rằng không có sự recomposing không cần thiết ở đây.

## Sử dụng compose coroutine scope sai cách

Hãy cùng xem xét ví dụ dưới đây:

```kotlin
@Composable
fun LoginScreen(
    viewModel: MainViewModel
) {
    val scope = rememberCoroutineScope()
    Box { 
        Button(
            onClick = {
                scope.launch {
                    viewModel.login()
                }
            }
        ) {

        }
    }
}
```

Và viewModel mà chúng ta gọi tới:

```kotlin
class MainViewModel: ViewModel() {

    suspend fun login() {

    }
}
```

Điều chúng ta có ở đây là gì, một ```rememberCoroutineScope``` cung cấp 1 scope cho event ```onClick``` để gọi function login từ ```viewModel```.

Vấn đề xảy ra ở đây là ```scope``` ở phía LoginScreen là UI Scope, nó có nghĩa là khi mà ta xoay màn hình hay là thay đổi config thì UI sẽ bị cancel, và nó tương ứng với việc login process sẽ luôn luôn bị cancel. Vậy thì thay vì tạo scope ở trong UI, hãy gọi scope ở trong viewModel. Chúng ta có 1 loại scope có sẵn đó là ```viewModelScope```. Vậy thì cách mà chúng ta sẽ sửa nó sẽ là:

```kotlin
@Composable
fun LoginScreen(
    viewModel: MainViewModel
) {
    Box { 
        Button(
            onClick = {
                viewModel.login()
            }
        ) {

        }
    }
}
```

```kotlin
class MainViewModel: ViewModel() {

    fun login() {
        viewModelScope.launch {

        }
    }
}
```

> Lưu ý: Chỉ có một vài trường hợp mà ta nên dùng **UI scope**:
1. Đó là **animation**, các **animation** api thường làm việc với các **suspend function** và **animation** là không phải thứ cần được thực thi ở **viewModel**, chúng có thể thực hiện xong một cách trực tiếp trên UI và đối với **animation** thì người dùng luôn muốn nó đơn giản dừng và khởi tạo lại khi mà xoay màn hình.
2. Thứ 2 là những thứ liên quan về việc show **snack bar compose**.

## Không dùng các Effect Handler

Trong coroutine chúng ta có hàng tá các **effect handler** khác nhau. Nhưng tôi thường xuyên thấy mọi người làm như thế này:

```kotlin
@Composable
fun LoginScreen(
    isLoggedIn: Boolean,
    navController: NavController
) {
    if(isLoggedIn) {
        navController.navigate( route: "main_screen")
    }
    Box { this: BoxScope
        // Content
    }
}
```

Họ sẽ có 1 compose state, check nó và sau đó họ thực hiện 1 điều gì nó như ví dụ trên là di chuyển màn hình.

> Bất cứ điều gì bạn làm ở UI mà không phải là **composable function** thì bạn nên wrap chúng lại bằng các **effect handler**.

Với ví dụ bên trên thì ```navController.navigate( route: "main_screen")``` không phải là 1 **composable function**. Trong hầu hết các trường hợp thì nó sẽ không sao nhưng mà đôi khi chúng ta không kiểm soát được lúc là **composable function** sẽ được recomposing nên sẽ có thể gây ra nhiều bug khá là kì cục bởi các side effects. Nên tốt nhất là cứ wrap chúng bằng **effect handler**.

Đây là đoạn code sau khi đã chỉnh sửa:

```kotlin
@Composable
fun LoginScreen(
    isLoggedIn: Boolean,
    navController: NavController
) {
    LaunchEffect(key1 = isLoggedIn) {
        if(isLoggedIn) {
            navController.navigate( route: "main_screen")
        }
    }

    Box { this: BoxScope
        // Content
    }
}
```

## Kết luận

Và trên tôi đã đề cập tới 3 lỗi mà mọi người thường hay mắc phải khi sử dụng **Jetpack Compose**. Trong quá trình làm việc, tôi sẽ cập nhật thêm về bài viết này.

Cảm ơn các bạn đã theo dõi.
