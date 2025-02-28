---
layout: post
current: post
cover: assets/images/collect-flow.png
navigation: True
title: Custom cardview trong Jetpack Compose 2
date: 2024-01-26 10:18:00
tags: compose
class: post-template
subclass: 'post'
author: kendis
---

Học cách custom view trong Jetpack Compose với ví dụ cụ thể là 1 cardview.

Từng lúc, nhà thiết kế trong nhóm chúng tôi lại nảy ra một ý tưởng tuyệt vời cho ứng dụng di động mà chúng tôi đang làm việc. Nhưng rồi, kinh hoàng ập đến: nó không dựa trên một thành phần gốc mà chúng ta có thể dễ dàng tìm thấy trong Hướng dẫn Material Design hoặc iOS Human Interface Design Guidelines. Nó mới mẻ, nó mới, nó tùy chỉnh.

Là một developer, đây chính là thời điểm chính xác khi bạn bắt đầu gãi đầu hoặc, ở mức tốt nhất, đề xuất một giải pháp thay thế bằng native. Nhưng nếu bạn có thể triển khai nó như vậy, một cách có thể tái sử dụng? Và không chỉ vậy, nếu bạn còn có thể tích hợp thêm một số hiệu ứng vào đó?

Hôm nay, chúng ta sẽ khám phá cách sử dụng Compose để dễ dàng triển khai một UI tùy chỉnh cao cấp, mang ý tưởng đột phát của nhà thiết kế thành hiện thực và tạo ra một trải nghiệm hình ảnh đáng kinh ngạc.

## Design
Design mà chúng ta sẽ làm việc trong bài tập này là một yếu tố hấp dẫn từ ứng dụng Ví Crypto, được tạo một cách tinh tế bởi Roman Lieliushkin. Bạn có thể kiểm tra công việc thiết kế di động tuyệt vời của anh ấy tại đây: https://www.behance.net/ozmoweb

![Design](assets/images/card-view-1.png)

Cụ thể hơn, chúng ta sẽ tập trung vào việc triển khai các card view ở giữa màn hình. Những card này sẽ hiển thị giá trị của một đồng tiền điện tử cũng như một số chi tiết bổ sung.

![Crypto Card](assets/images/card-view-2.png)



## Cơ bản

Bước đầu tiên chúng ta thực hiện khi xử lý một UI tùy chỉnh như thế này là tìm kiếm bản đồng bộ gần nhất có thể phục vụ như một nền tảng. Cách tiếp cận này giúp chúng ta giảm thiểu lượng công việc cần thiết. May mắn thay, trong trường hợp này, nó khá đơn giản. Chúng ta có thể sử dụng một Card cơ bản, cung cấp cấu trúc cơ bản của góc bo tròn cho thành phần của chúng ta.

```kotlin
val cardSize = 150.dp
Card(
    modifier = Modifier.size(cardSize).clip(RoundedCornerShape(15.dp)),
    colors = CardDefaults.cardColors(containerColor = Color.Black)
) { ... }
```

![Base card view](assets/images/card-view-3.png)

Bây giờ, hãy đến với canvas và suy nghĩ xem làm cách nào chúng ta có thể tạo ra hình dạng độc đáo này bằng cách sử dụng các hình khác.

Hợp tác chặt chẽ với designer sẽ rất có lợi ở thời điểm này. Họ có thể cung cấp những thông tin quý giá về việc tạo ra yếu tố tùy chỉnh, giúp chúng ta dễ dàng dịch và tích hợp nó vào tác phẩm tùy chỉnh của chúng ta.

Kế hoạch hiện tại là sử dụng các hình dạng khác nhau để "che" hoặc "cắt" thẻ gốc để đạt được hình dạng tùy chỉnh mong muốn. Chúng ta sẽ bắt đầu bằng cách tạo ra các hình vuông sẽ được điền bằng màu nền của giao diện người dùng của chúng ta, tạo ảo ảnh như đang bị cắt.

## Canvas

Trong Card của chúng ta, chúng ta sẽ sử dụng ```Canvas``` Composable, một phần quan trọng trong kế hoạch phát triển một thành phần tùy chỉnh mới.

```Canvas``` cho phép chúng ta đặt các **hình dạng** hoặc **đường thẳng** bất kỳ **kích thước** và **màu sắc** tại bất kỳ cặp tọa độ x, y nào. Bước đầu tiên của chúng ta là thêm các hộp màu trắng hình chữ nhật để loại bỏ các phần không cần thiết của Card ban đầu, được thực hiện thông qua việc sử dụng drawRect().

```kotlin
val cardSize = 150.dp
Card(
    modifier = Modifier.size(cardSize).clip(RoundedCornerShape(15.dp)),
    colors = CardDefaults.cardColors(containerColor = Color.Black)
) {
    Canvas(modifier = Modifier.size(cardSize), onDraw = {
        drawRect(
            color = backgroundColor,
            topLeft = Offset(x = size.width - radius + (radius * 0.2f), y = 12f),
            size = size / 2f,
        )

...
```

![Canvas with Rect](assets/images/card-view-4.png)

```kotlin	
val cardSize = 150.dp
Card(
    modifier = Modifier.size(cardSize).clip(RoundedCornerShape(15.dp)),
    colors = CardDefaults.cardColors(containerColor = Color.Black)
) {
    Canvas(modifier = Modifier.size(cardSize), onDraw = {
        drawRect(
            color = backgroundColor,
            topLeft = Offset(x = size.width - radius + (radius * 0.2f), y = 12f),
            size = size / 2f,
        )

        drawRect(
            color = backgroundColor,
            topLeft = Offset(x = cardSize.value * 1.3f, y = cardSize.value * -1f),
            size = size / 2f,
        )

...
```

![More rect](assets/images/card-view-5.png)

Để tạo hình dáng cong ở phần cắt phía trên, tôi đã sử dụng ba hình tròn được đặt một cách chiến lược xung quanh góc. Bằng cách pha trộn một phần màu nền (trắng) với màu thẻ (đen), nó đã thành công trong việc tạo hình dáng cong cho phần trên bên trái của thẻ. May mắn thay, có một cách dễ dàng để vẽ hình tròn trên Canvas bằng cách sử dụng drawCircle().

![Draw circles](assets/images/card-view-6.png)

```kotlin
		drawCircle(
        color = Color.Red,
        radius = cardSize.value / 1.5f,
        center = Offset(
            x = size.width - radius + (radius * 0.2f),
            y = radius - (radius * 0.2f)
        )
    )

    drawCircle(
        color = Color.Green,
        radius = radius * 0.8f,
        center = Offset(
            x = size.width / 2.14f,
            y = radius - (radius * 0.2f)
        )
    )

    drawCircle(
        color = Color.Green,
        radius = radius * 0.8f,
        center = Offset(
            x = size.width - radius + (radius * 0.2f),
            y = radius + (radius * 1.93f)
        )
    )
```

Tôi đang highlight chúng ở đây để dễ nhìn nhưng ý tưởng là những cái màu xanh sẽ được chuyển thành màu card và cái màu đỏ sẽ được tô màu nền.

![Change color](assets/images/card-view-7.png)

Cuối cùng, hãy thêm backgroud hình tròn mà thiết kế gốc đã có để hiển thị biểu tượng crypto. Để làm điều này, chúng ta thêm một hình tròn nữa.

![Add crypto icon background](assets/images/card-view-8.png)

```kotlin
      drawCircle(
          color = bubbleColor,
          radius = radius * 0.8f,
          center = Offset(
              x = size.width - radius + (radius * 0.2f),
              y = radius - (radius * 0.2f)
          )
      )
```

Toàn bộ Canvas:

```kotlin
Canvas(modifier = Modifier.size(cardSize), onDraw = {
      drawRect(
          color = backgroundColor,
          topLeft = Offset(x = size.width - radius + (radius * 0.2f), y = 12f),
          size = size / 2f,
      )

      drawRect(
          color = backgroundColor,
          topLeft = Offset(x = cardSize.value * 1.3f, y = cardSize.value * -1f),
          size = size / 2f,
      )

      drawCircle(
          color = backgroundColor,
          radius = cardSize.value / 1.5f,
          center = Offset(
              x = size.width - radius + (radius * 0.2f),
              y = radius - (radius * 0.2f)
          )
      )

      drawCircle(
          color = cardBackground,
          radius = radius * 0.8f,
          center = Offset(
              x = size.width / 2.14f,
              y = radius - (radius * 0.2f)
          )
      )

      drawCircle(
          color = cardBackground,
          radius = radius * 0.8f,
          center = Offset(
              x = size.width - radius + (radius * 0.2f),
              y = radius + (radius * 1.93f)
          )
      )

      drawCircle(
          color = bubbleColor,
          radius = radius * 0.8f,
          center = Offset(
              x = size.width - radius + (radius * 0.2f),
              y = radius - (radius * 0.2f)
          )
      )

  })
```

Khi hiển thị Composable này trên bề mặt màu Trắng, các vết còn lại của Thẻ mà chúng ta đã che phủ có thể nhìn thấy một chút ở góc phải trên cùng.

Để sửa nó, chúng ta có thể bọc toàn bộ Card vào một Box và thêm một Canvas thứ hai là phần tử cuối cùng, che phủ khu vực đó bằng drawRect khác và đưa hình tròn màu xám lên trên đó.

```kotlin
Canvas(modifier = Modifier.size(cardSize), onDraw = {
    drawRect(
        color = backgroundColor,
        topLeft = Offset(x = size.width - (cardSize.value / 2f) - 7.5f, y = 0f),
        size = size / 5f
    )

    drawCircle(
        color = bubbleColor,
        radius = radius * 0.8f,
        center = Offset(
            x = size.width - radius + (radius * 0.2f),
            y = radius - (radius * 0.2f)
        )
    )
})
```

```kotlin
...
Box {
        Card(
...
```

Và chúng ta cũng làm cho Composable của chúng ta có thể tùy chỉnh để nền và bubble màu xám có thể dễ dàng điều chỉnh để phù hợp với các style và thêm khác nhau.

```kotlin
@Composable
fun CryptoCardBackground(
    cardBackground: Color = Color.Black,
    bubbleColor: Color = Color(0xFFf3f3f3),
    backgroundColor: Color = Color.White,
    cardSize: Dp = 150.dp,
) {

  ...

}
```

![Complete background](assets/images/card-view-9.png)

Vậy là chúng ta đã làm xong phần khó nhất của Compose View này rồi, việc còn lại sẽ bọc lại với Box, chúng ta sẽ có UI như mong muốn.

Code sẽ ở đây: https://github.com/kendis1002/AN_custom_card_view



