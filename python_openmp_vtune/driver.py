#!/usr/bin/env python
import plib
import time
mylist = [1, 2, 3] * 100000000
t = time.time()
print plib.our_function(mylist)
t = time.time() - t
print t

